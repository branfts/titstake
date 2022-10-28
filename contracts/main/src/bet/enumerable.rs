use crate::*;
use near_sdk::json_types::{U64, U128};
use near_sdk::log; // no-production

#[near_bindgen]
impl Contract {
    pub fn bets(
        &self,
        person: Option<Person>,
        bet_ids: Option<Vec<String>>,
        ended: Option<bool>,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<WrappedBet> {
        //where to start pagination - if we have a from_index, we'll use that - otherwise start from 0 index
        let start = u128::from(from_index.unwrap_or(U128(0)));
        let now = env::block_timestamp() + env::block_height();
        let mut bets: Vec<BetId>;

        if let Some(person) = person {
            bets = self.bets.to_vec()
            .iter()
            .filter(|(_, bet)| bet.person == person)
            .map(|(bet_id, _)| bet_id.to_string())
            .collect();
        } else {
            bets = self.bets.keys_as_vector()
                .iter()
                .collect();
        }

        if let Some(bet_ids) = bet_ids {
            bets = bets
                .into_iter()
                .filter(|bet_id| bet_ids.contains(&bet_id))
                .collect();
        } else {
            //iterate through the keys vector
            bets = bets
                .into_iter()
                //skip to the index we specified in the start variable
                .skip(start as usize)
                //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
                .take(limit.unwrap_or(50) as usize)
                .collect();
        }
        bets.iter()
            .map(|bet_id| {
                let bet = self.bets.get(&bet_id).unwrap();
                WrappedBet {
                    bet_id: bet_id.to_string(),
                    prediction: bet.clone().prediction,
                    person: bet.clone().person,
                    end: bet.clone().end,
                }
            })
            .filter(|wrapped_bet| {
                if ended.is_some() {
                    if ended.unwrap() {
                        return wrapped_bet.end < now
                    } else {
                        return wrapped_bet.end > now
                    }
                }
                true
            })
            .collect()
    }
    pub fn bets_count(&self) -> U64 {
        U64::from(self.bets.len())
    }
    pub fn persons_count(&self) -> U64 {
        U64::from(self.persons.len())
    }
    pub fn stakes_count(&self) -> U64 {
        U64::from(self.bets.len())
    }
    pub fn persons(
        &self,
        from_index: Option<U128>,
        limit: Option<u64>,
        exclude: Option<Vec<Person>>
    ) -> Vec<Person> {
        if let Some(exclude) = exclude {
            let mut taken = 0;
            self.persons.iter()
                .take_while(|person| {
                    if !exclude.contains(person) {
                        taken += 1;
                    }
                    taken < limit.unwrap_or(50) as usize
                })
                .filter(|person| !exclude.contains(person))
                .collect()
        } else {
            //where to start pagination - if we have a from_index, we'll use that - otherwise start from 0 index
            let start = u128::from(from_index.unwrap_or(U128(0)));

            //iterate through the keys vector
            self.persons.iter()
                //skip to the index we specified in the start variable
                .skip(start as usize)
                //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
                .take(limit.unwrap_or(50) as usize)
                //since we turned the keys into an iterator, we need to turn it back into a vector to return
                .collect()
        }
    }
    pub fn stakes(
        &self,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<WrappedStake> {
        //where to start pagination - if we have a from_index, we'll use that - otherwise start from 0 index
        let start = u128::from(from_index.unwrap_or(U128(0)));

        //iterate through the keys vector
        self.stakes
            .iter()
            //skip to the index we specified in the start variable
            .skip(start as usize)
            //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
            .take(limit.unwrap_or(50) as usize)
            .map(|(key, stake)| WrappedStake {
                stake_id: key,
                bet_id: stake.bet_id,
                position: stake.position,
                amount: U128(stake.amount),
                staker: stake.staker,
                unmatched: U128(stake.unmatched),
                gentlemans: stake.gentlemans,
            })
            //since we turned the keys into an iterator, we need to turn it back into a vector to return
            .collect()
    }

    pub fn stakes_for_bets(
        &self,
        bet_ids: Vec<BetId>,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<WrappedStake> {
        //where to start pagination - if we have a from_index, we'll use that - otherwise start from 0 index
        let start = u128::from(from_index.unwrap_or(U128(0)));

        //iterate through the keys vector
        self.stakes
            .iter()
            .filter(|(_, stake)| bet_ids.contains(&stake.bet_id))
            //skip to the index we specified in the start variable
            .skip(start as usize)
            //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
            .take(limit.unwrap_or(50) as usize)
            .map(|(key, stake)| WrappedStake {
                stake_id: key,
                bet_id: stake.bet_id,
                position: stake.position,
                amount: U128(stake.amount),
                staker: stake.staker,
                unmatched: U128(stake.unmatched),
                gentlemans: stake.gentlemans,
            })
            //since we turned the keys into an iterator, we need to turn it back into a vector to return
            .collect()
    }

    pub fn stake_earnings(
        &self,
        stake_ids: Vec<StakeId>
    ) -> Vec<WrappedStakeEarning> {
        stake_ids
            .into_iter()
            .map(|stake_id| {
                let stake_earning = self.internal_calculate_stake_earning(stake_id.clone());
                WrappedStakeEarning {
                    stake_id: stake_id.clone(),
                    total_balance: U128::from(self.stakes.get(&stake_id).unwrap().amount),
                    epochs: stake_earning.epochs,
                    yield_balance: stake_earning.yield_balance
                }
            })
            .collect()
    }

    pub fn stakes_for_person(
        &self,
        staker: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> (Vec<WrappedStake>, Vec<WrappedBet>) {
        //where to start pagination - if we have a from_index, we'll use that - otherwise start from 0 index
        let start = u128::from(from_index.unwrap_or(U128(0)));
        let mut bet_ids: Vec<BetId> = vec!();

        //iterate through the keys vector
        let wrapped_stakes = self.stakes
            .iter()
            .filter(|(_, stake)| staker == stake.staker)
            //skip to the index we specified in the start variable
            .skip(start as usize)
            //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
            .take(limit.unwrap_or(50) as usize)
            .map(|(key, stake)| {
                if !bet_ids.contains(&stake.bet_id) {
                    bet_ids.push(stake.bet_id.clone());
                }
                WrappedStake {
                    stake_id: key,
                    bet_id: stake.bet_id,
                    position: stake.position,
                    amount: U128(stake.amount),
                    staker: stake.staker,
                    unmatched: U128(stake.unmatched),
                    gentlemans: stake.gentlemans,
                }
            })
            //since we turned the keys into an iterator, we need to turn it back into a vector to return
            .collect();
        let wrapped_bets = bet_ids
            .iter()
            .map(|bet_id| {
                let bet = self.bets.get(&bet_id).unwrap();
                WrappedBet {
                    bet_id: bet_id.to_string(),
                    prediction: bet.clone().prediction,
                    person: bet.clone().person,
                    end: bet.clone().end,
                }
            })
            .collect();
        return (wrapped_stakes, wrapped_bets)
    }
}
