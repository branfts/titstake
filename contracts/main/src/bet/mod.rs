use crate::*;

use near_sdk::json_types::U128;
use near_sdk::{EpochHeight, Timestamp, ext_contract, PromiseResult, serde_json};
use near_sdk::log; // no-production
use uint::construct_uint;

construct_uint! {
    /// 256-bit unsigned integer.
    pub struct U256(4);
}

pub mod enumerable;
pub mod internal;

pub type Person = String;
pub type BetId = String;
pub type MotionId = String;
pub type StakeId = String;
pub type Epoch = u64;

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct StakeEarning {
    epochs: (u64, u64),
    yield_balance: U128,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct WrappedStakeEarning {
    stake_id: StakeId,
    epochs: (u64, u64),
    yield_balance: U128,
    total_balance: U128,
}

#[derive(BorshDeserialize, Deserialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Motion {
    pub motion_id: MotionId,
    pub category: Option<String>,
    pub description: String,
    pub status: String,
    pub registered: Vec<AccountId>,
    pub log: Vec<String>,
    pub quorum: Option<u32>,
    pub end: Option<Timestamp>,
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash,
)]
#[serde(crate = "near_sdk::serde")]
pub enum Prediction {
    Reduction,
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash, Debug
)]
#[serde(crate = "near_sdk::serde")]
pub enum Position {
    Back,
    Lay,
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash,
)]
#[serde(crate = "near_sdk::serde")]
pub struct Bet {
    pub prediction: Prediction,
    pub person: String,
    pub end: Timestamp,
    pub motion_id: Option<String>
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash, Debug
)]
#[serde(crate = "near_sdk::serde")]
pub struct Stake {
    pub bet_id: BetId,
    pub position: Position,
    pub amount: Balance,
    pub staker: AccountId,
    pub unmatched: Balance,
    pub gentlemans: bool,
    pub epoch: EpochHeight,
}
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Hash, Debug
)]
#[serde(crate = "near_sdk::serde")]
pub struct CancelledStake {
    pub bet_id: BetId,
    pub amount: Balance,
    pub staker: AccountId,
    pub epoch: EpochHeight,
    pub cancelled: bool
}
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize
)]
#[serde(crate = "near_sdk::serde")]
pub struct WrappedBet {
    pub bet_id: BetId,
    pub prediction: Prediction,
    pub person: String,
    pub end: Timestamp,
}
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize
)]
#[serde(crate = "near_sdk::serde")]
pub struct WrappedStake {
    pub stake_id: StakeId,
    pub bet_id: BetId,
    pub position: Position,
    pub amount: U128,
    pub staker: AccountId,
    pub unmatched: U128,
    pub gentlemans: bool,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn new_stake(&mut self,
        bet_id: BetId,
        stake_id: String,
        prediction: Prediction,
        position: Position,
        person: String,
        end: Timestamp,
        gentlemans: Option<bool>,
    ) {
        if env::attached_deposit() < MIN_STAKE {
            env::panic_str(&("ERR_INVALID MIN_STAKE: ".to_owned() + &MIN_STAKE.to_string()).as_str());
        }
        if !is_valid_id(&bet_id.as_bytes().to_vec()) {
            env::panic_str(&("ERR_INVALID bet_id: ".to_owned() + &bet_id.to_string()).as_str());
        }
        if !is_valid_id(&stake_id.as_bytes().to_vec()) {
            env::panic_str(&("ERR_INVALID stake_id : ".to_owned() + &stake_id.to_string()).as_str());
        }
        if self.stakes.get(&stake_id).is_some() {
            env::panic_str(&("ERR_EXISTS stake_id: ".to_owned() + &stake_id.to_string()).as_str());
        }
        let soonest_end = env::block_timestamp() + MIN_DURATION;
        if end <= soonest_end {
            env::panic_str(&("ERR_INVALID end: ".to_owned() + &end.to_string().as_str() + " <= " + &soonest_end.to_string()));
        }

        let pool = &self
            .metadata
            .get()
            .unwrap()
            .pool
            .unwrap_or(DEFAULT_STAKE_POOL.parse().unwrap());
        let mut amount = internal::deduct_storage_cost(self.extra_storage_in_bytes_per_stake);

        self.bets.get(&bet_id).unwrap_or({
            let bet = Bet {
                prediction,
                person: person.clone(),
                end,
                motion_id: None,
            };
            self.bets.insert(&bet_id, &bet);
            amount = internal::deduct_storage_cost(self.extra_storage_in_bytes_per_bet);

            bet
        });

        let stake = Stake {
            bet_id,
            position,
            amount: amount.clone(),
            staker: env::predecessor_account_id(),
            unmatched: amount,
            gentlemans: gentlemans.unwrap_or(false),
            epoch: env::epoch_height(),
        };

        self.persons.insert(&person);

        // Call staking contract and insert on return
        ext_deposit_and_stake::ext(pool.clone())
            .with_attached_deposit(amount.clone())
            .deposit_and_stake()
            .then(ext_self::ext(env::current_account_id()).deposit_and_stake_callback(stake_id.clone(), stake));
    }

    #[payable]
    pub fn cancel_stake(&mut self,
        bet_id: BetId,
        stake_id: String,
    ) -> String {
        let pool = &self
            .metadata
            .get()
            .unwrap()
            .pool
            .unwrap_or(DEFAULT_STAKE_POOL.parse().unwrap());
        let initial_storage_usage = env::storage_usage();
        let stake = self.stakes.get(&stake_id).unwrap_or_else(|| {
            env::panic_str(&("ERR_DOES_NOT_EXIST stake_id: ".to_owned() + &stake_id.to_string()).as_str())
        });
        let mut cancel_status = "not cancelled";

        if self.bets.get(&bet_id).is_none() {
            env::panic_str(&("ERR_DOES_NOT_EXIST bet_id: ".to_owned() + &bet_id.to_string()).as_str());
        }
        if stake.staker != env::predecessor_account_id() {
            env::panic_str("ERR_NOT_AUTHORIZED");
        }
        if self.cancelled_stakes.get(&stake_id).is_some() {
            env::panic_str(&("ERR_ALREADY_CANCELLED stake_id: ".to_owned() + &stake_id.to_string()).as_str())
        }

        if stake.unmatched > 0 {
            if stake.unmatched == stake.amount {
                cancel_status = "full cancellation pending...";
            } else {
                cancel_status = "partial cancellation pending...";
            }

            let cancelled_stake = CancelledStake {
                bet_id: bet_id.clone(),
                amount: stake.unmatched.clone(),
                staker: env::predecessor_account_id(),
                epoch: env::epoch_height(),
                cancelled: false,
            };

            self.cancelled_stakes.insert(&stake_id, &cancelled_stake.clone());
            
            ext_unstake::ext(pool.clone()).unstake(stake.unmatched.to_string())
                .then(ext_self::ext(env::current_account_id())
                .unstake_callback(stake_id));
        }

        internal::refund_deposit(env::storage_usage() - initial_storage_usage);

        cancel_status.to_string()
    }

    pub fn refund_cancelled_stake(&mut self,
        stake_id: String,
    ) {
        let cancelled_stake = self.cancelled_stakes.get(&stake_id).unwrap_or_else(|| {
            env::panic_str(&("ERR_DOES_NOT_EXIST stake_id: ".to_owned() + &stake_id.to_string()).as_str())
        });
        if cancelled_stake.clone().cancelled {
            env::panic_str("ERR_CANCELLED");
        }
        let epochs_elapsed = env::epoch_height() - cancelled_stake.clone().epoch;
        if epochs_elapsed < REFUND_DELAY_EPOCHS.into() {
            env::panic_str(&("ERR_LOCKED epochs_elapsed: ".to_owned() + &epochs_elapsed.to_string()).as_str());
        }
        Promise::new(cancelled_stake.clone().staker).transfer(cancelled_stake.clone().amount)
            .then(ext_self::ext(env::current_account_id())
            .refund_cancelled_stake_callback(cancelled_stake));
    }

    #[payable]
    pub fn change_stake_pool(&mut self, pool: AccountId) -> ContractMetadata {
        assert_admin(&self.owner_id, &self.metadata.get().unwrap().admins);
        assert_one_yocto();

        let metadata = self.metadata.get().unwrap();
        let updated_metadata = ContractMetadata {
            pool: Some(pool),
            ..metadata
        };

        self.metadata.replace(&updated_metadata);

        updated_metadata
    }

    #[payable]
    pub fn change_admin_users(&mut self, admins: Vec<AccountId>) -> ContractMetadata {
        assert_one_yocto();

        let metadata = self.metadata.get().unwrap();

        assert_admin(&self.owner_id, &self.metadata.get().unwrap().admins);
        
        let updated_metadata = ContractMetadata {
            admins: Some(admins),
            ..metadata
        };

        self.metadata.replace(&updated_metadata);

        updated_metadata
    }

    #[payable]
    pub fn check_bets(&mut self, bet_ids: Option<Vec<MotionId>>) -> Promise {
        // a valid user is required other than the contract itself
        if env::predecessor_account_id() != env::current_account_id() {
            assert_one_yocto();
        }
        let now = env::block_timestamp() + env::block_height();
        let filtered_bet_ids = self.bets
            .iter()
            .filter(|(bet_id, bet)| bet_ids.as_ref().unwrap_or(&vec![]).contains(bet_id) && bet.end > now && bet.motion_id.is_none())
            .map(|(bet_id, _)| bet_id)
            .collect();

        self.start_bet_settlement(filtered_bet_ids)
    }

    pub fn deposit_and_stake_callback(&mut self, stake_id: String, stake: Stake) -> String {
        assert_callback();
      
        let mut offset = 0;
        if DEFAULT_STAKE_POOL == "legends.pool.f863973.m0" {
            offset = 30 * 2; // a month
        }
        // handle the result from the cross contract call this method is a callback for
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => "oops!".to_string(),
            PromiseResult::Successful(_result) => {
                // maybe we should be saving some unique id from the staking pool transaction for fast lookups later during calculations, etc... also to double check our own time based APY calculations. In which case the stake object should be updated to hold said id.
                self.stakes.insert(&stake_id.clone(), &stake);
                let epoch = env::epoch_height() + offset;
                let account = self.accounts.get(&stake.staker);
                let earning = StakeEarning {
                    epochs: (epoch.clone(), epoch),
                    yield_balance: U128(0)
                };

                if let Some(mut account) = account {
                    account.earnings.insert(&stake_id, &earning);
                    self.accounts.insert(&stake.staker, &account);
                } else {
                    let mut earnings = UnorderedMap::new(earning.try_to_vec().unwrap());
                    earnings.insert(&stake_id, &earning);
                    self.accounts.insert(&stake.staker, &Account {
                        earnings
                    });
                }

                self.match_stake(stake_id);
                "ok".to_string()
            },
        }
    }

    pub fn unstake_callback(&mut self, stake_id: String) -> String {
        assert_callback();
      
        // handle the result from the cross contract call this method is a callback for
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => {
                self.cancelled_stakes.remove(&stake_id);
                "oops!".to_string()
            },
            PromiseResult::Successful(_result) => {
                "ok".to_string()
            },
        }
    }

    pub fn refund_cancelled_stake_callback(&self, cancelled_stake: &mut CancelledStake) -> String {
        assert_callback();
      
        // handle the result from the cross contract call this method is a callback for
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => "oops!".to_string(),
            PromiseResult::Successful(_result) => {
                cancelled_stake.cancelled = true;
                "ok".to_string()
            },
        }
    }

    pub fn voting_callback(&mut self, bet_ids: &Vec<BetId>) -> Option<Vec<Option<(MotionId, BetId)>>> {
        assert_callback();
      
        // handle the result from the cross contract call this method is a callback for
        match env::promise_result(0) {
            PromiseResult::NotReady => unreachable!(),
            PromiseResult::Failed => None,
            PromiseResult::Successful(result) => {
                let motions: Vec<Motion> = serde_json::from_slice(&result).unwrap();
                Some(motions.into_iter().map(|motion| {
                    let bet_id = bet_ids.iter().find(|bet_id| motion.description.contains(bet_id.as_str()));

                    if let Some(bet_id) = bet_id {
                        let bet = self.bets.get(&bet_id).unwrap();
                    
                        self.bets.remove(&bet_id);
                        self.bets.insert(&bet_id, &Bet {
                            motion_id: Some(motion.clone().motion_id),
                            ..bet
                        });
                        Some((motion.motion_id, bet_id.to_owned()))
                    } else {
                        None
                    }
                })
                .filter(|m| m.is_some())
                .collect())
            },
        }
    }

}

#[ext_contract(ext_get_account_total_balance)]
pub trait GetAccountTotalBalance {
    fn get_account_total_balance(&mut self);
}

#[ext_contract(ext_deposit_and_stake)]
pub trait DepositAndStake {
    fn deposit_and_stake(&mut self);
}

#[ext_contract(ext_unstake)]
pub trait Unstake {
    fn unstake(&mut self, amount: String);
}

#[ext_contract(ext_voting)]
pub trait CreateMotion {
    fn motions(&mut self, params: Vec<(
        Option<String>,
        String,
        Option<bool>,
        Option<u32>,
        Option<Vec<String>>
    )>);
}

#[ext_contract(ext_self)]
trait ExtSelf {
    fn deposit_and_stake_callback(&self, stake_id: String, stake: Stake) -> String;
    fn unstake_callback(&self, stake_id: String) -> String;
    fn refund_cancelled_stake_callback(&self, cancelled_stake: CancelledStake) -> String;
    fn voting_callback(&self, bet_ids: Vec<String>) -> Vec<Option<(String, String)>>;
}
