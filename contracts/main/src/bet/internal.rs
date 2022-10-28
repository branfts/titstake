use crate::*;

use near_sdk::json_types::U128;
use near_sdk::log; // no-production

#[near_bindgen]
impl Contract {
    pub (crate) fn match_stake(
        &mut self,
        stake_id: String
    ) {
        let mut new_stake = self.stakes.get(&stake_id).unwrap();
        if new_stake.gentlemans {
            return;
        }
        /*
            1. sort highest to lowest
            2. for each loop if id <= bet_id subtract id from bet_id's unmatched amount, set unmatched amount of id to zero
        */
        let mut opposites: Vec<(StakeId, Stake)> = self.stakes.iter()
            .filter_map(|(stake_id, stake)| {
                if stake.bet_id == new_stake.bet_id && stake.position != new_stake.position && stake.unmatched > 0 {
                    Some((stake_id, stake))
                } else {
                    None
                }
            })
            .collect();
        // log!("opposites: {:?}", opposites); // no-production
        opposites.sort_by(|a, b| a.1.unmatched.cmp(&b.1.unmatched));
        // log!("opposites (sorted): {:?}", opposites); // no-production
        for mut stake in opposites.clone() {
            if stake.1.unmatched <= new_stake.unmatched {
                new_stake.unmatched = new_stake.unmatched - stake.1.unmatched;
                stake.1.unmatched = 0;
                self.stakes.insert(&stake.0, &stake.1);
                log!("0 stake: {:?}", stake); // no-production
            } else {
                stake.1.unmatched = stake.1.unmatched - new_stake.unmatched;
                self.stakes.insert(&stake.0, &stake.1);
                new_stake.unmatched = 0;
        
                log!("1 stake: {:?}", stake); // no-production
                break;
            }
        }
    }

    pub (crate) fn start_bet_settlement(
        &mut self,
        bet_ids: Vec<BetId>
    ) -> Promise {
        let motions_params: Vec<(Option<String>, String, Option<bool>, Option<u32>, Option<Vec<String>>)> = bet_ids.iter().map(|bet_id| {
            let voting_pool: Vec<String> = self.stakes.values_as_vector()
                .iter()
                .filter(|stake| bet_id == &stake.bet_id.clone())
                .map(|stake| stake.staker.to_string())
                .collect();
            if voting_pool.len() <= 0 {
                env::panic_str("ERR_NO_MATCHING_BETS");
            }
            let quorum: u32 = ((voting_pool.len() / 2) + 1) as u32; // improve this
            (
                Some("bet".to_string()),
                bet_id.clone(),
                None,
                Some(quorum),
                Some(voting_pool)
            )
        })
        .collect();

        // motion(&mut self, category: Option<String>, description: String, value: Option<VoteValue>, quorum: Option<u32>, pool: Option<Vec<AccountId>>) -> Motion {
        ext_voting::ext(VOTING_CONTRACT.parse().unwrap())
            .with_attached_deposit(1)
            .motions(motions_params)
            .then(ext_self::ext(env::current_account_id()).voting_callback(bet_ids.clone()))
    }

    pub(crate) fn internal_calculate_stake_earning(
        &self,
        stake_id: StakeId,
    ) -> StakeEarning {        
        // what happens if/when the stake pool is changed and stakes are spread accross pools?!  Answer: move pool to the stake object.
        let pool = &self
            .metadata
            .get()
            .unwrap()
            .pool
            .unwrap_or(DEFAULT_STAKE_POOL.parse().unwrap());
        let stake = self.stakes.get(&stake_id.clone()).unwrap_or_else(|| {
            env::panic_str(&("ERR_DOES_NOT_EXIST stake_id: ".to_owned() + &stake_id.clone().to_string()).as_str())
        });
    
        let mut offset = 0;
        if DEFAULT_STAKE_POOL == "legends.pool.f863973.m0" {
            offset = 30 * 2; // a month
        }
    
        let epoch = env::epoch_height() + offset;
        let mut account = self.accounts.get(&stake.staker).unwrap();
        let mut stake_earning = account.earnings.get(&stake_id.clone()).unwrap();
        let last_epoch = stake_earning.epochs.1;
    
        if last_epoch == epoch {
            return stake_earning;
        }
    
        let epochs_per_year = 365 * 2;
        let factor = U256::from(stake.amount) * U256::from(APY.0) / U256::from(APY.1).as_u128();
        let yield_per_epoch = factor.as_u128() / epochs_per_year;
        let epochs_staked = last_epoch - epoch;
    
        stake_earning = StakeEarning {
            epochs: (last_epoch, epoch),
            yield_balance: yield_balance += U128::from(yield_per_epoch * epochs_staked as u128),
        };
    
        account.earnings.insert(&stake_id, &stake_earning.clone());
    
        stake_earning
    }
}

pub(crate) fn assert_callback() {
    if env::promise_results_count() != 1 {
        env::panic_str("ERR_CALLBACK_METHOD")
    }
}

pub(crate) fn assert_deposit(required_cost: Balance) {
    if required_cost > env::attached_deposit() {
        env::panic_str("ERR_INSF_DEPOSIT")
    }
}

pub(crate) fn deduct_storage_cost(storage_used: u64) -> u128 {
    let required_cost = env::storage_byte_cost() * Balance::from(storage_used);
    let attached_deposit = env::attached_deposit();

    assert_deposit(required_cost);

    attached_deposit - required_cost
}

pub(crate) fn refund_deposit(storage_used: u64) {
    let required_cost = env::storage_byte_cost() * Balance::from(storage_used);
    let attached_deposit = env::attached_deposit();

    assert_deposit(required_cost);

    let refund = attached_deposit - required_cost;
    if refund > 1 {
        Promise::new(env::predecessor_account_id()).transfer(refund);
    }
}

pub fn is_valid_id(id: &[u8]) -> bool {
    if (id.len() as u8) != ID_LEN {
        return false;
    }

    // NOTE: We don't want to use Regex here, because it requires extra time to compile it.
    // The valid ID regex is /^[\w-]{21}$/ based on nanoid
    // Instead the implementation is based on the previous character checks.
    let mut invalid_char = false;
    for c in id {
        invalid_char = match *c {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' => false,
            _ => true,
        };
    }
    !invalid_char
}

pub(crate) fn assert_one_yocto() {
    if env::attached_deposit() != 1 {
        env::panic_str("Requires attached deposit of exactly 1 yoctoNEAR");
    }
}

pub(crate) fn assert_admin(owner_id: &AccountId, admins: &Option<Vec<AccountId>>) {
    if let Some(admins) = admins {
        if admins.iter().find(|admin_id| &env::predecessor_account_id() == owner_id || &&env::predecessor_account_id() == admin_id).is_none() {
            env::panic_str("ERR_NOT_ADMIN");
        }
    } else {
        if &env::predecessor_account_id() != owner_id {
            env::panic_str("ERR_NOT_ADMIN");
        }
    }
}

pub(crate) fn yton(yocto_amount: Balance) -> String { // no-production
    format!("{:.2}", yocto_amount as f64 / 10u128.pow(24) as f64) // no-production
} // no-production