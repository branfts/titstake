use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LazyOption, UnorderedMap, UnorderedSet};
use near_sdk::json_types::{Base64VecU8};
use near_sdk::serde::{Serialize, Deserialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, StorageUsage,
};

pub use crate::bet::internal::*;
pub use crate::bet::*;

mod bet;

#[cfg(not(near_testnet))]
const DEFAULT_STAKE_POOL: &str = "astro-stakers.poolv1.near";
#[cfg(not(near_testnet))]
const REFUND_DELAY_EPOCHS: u8 = 4;
#[cfg(not(near_testnet))]
const MIN_DURATION: u64 = 30 * 86_400_000_000_000; // 30 days
#[cfg(not(near_testnet))]
const VOTING_CONTRACT: &str = "voting.titstake.testnet.near"; // will change to voting.titstake.near after a while.

#[cfg(near_testnet)]
const DEFAULT_STAKE_POOL: &str = "legends.pool.f863973.m0";
#[cfg(near_testnet)]
const REFUND_DELAY_EPOCHS: u8 = 0;
#[cfg(near_testnet)]
const MIN_DURATION: u64 = 0;
#[cfg(near_testnet)]
const VOTING_CONTRACT: &str = "dev-1663982099301-84507361434162";

const ID_LEN: u8 = 21;
const MIN_STAKE: Balance = 69_000_000_000_000_000_000_000;
const APY: (u32, u32) = (45, 100);

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
    pub pool: Option<AccountId>,
    pub admins: Option<Vec<AccountId>>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub persons: UnorderedSet<Person>,
    pub bets: UnorderedMap<BetId, Bet>,
    pub stakes: UnorderedMap<StakeId, Stake>,
    pub cancelled_stakes: UnorderedMap<StakeId, CancelledStake>,
    pub extra_storage_in_bytes_per_bet: StorageUsage,
    pub extra_storage_in_bytes_per_stake: StorageUsage,
    pub metadata: LazyOption<ContractMetadata>,
}

/// Helper structure to for keys of the persistent collections.
#[derive(BorshSerialize)]
pub enum StorageKey {
    ContractMetadata,
    Persons,
    Bets,
    Stakes,
    StakesCancelled,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, metadata: ContractMetadata) -> Self {
        let mut this = Self {
            owner_id: owner_id.into(),
            persons: UnorderedSet::new(
                StorageKey::Persons.try_to_vec().unwrap()
            ),
            extra_storage_in_bytes_per_bet: 0,
            extra_storage_in_bytes_per_stake: 0,
            metadata: LazyOption::new(
                StorageKey::ContractMetadata.try_to_vec().unwrap(),
                Some(&metadata),
            ),
            bets: UnorderedMap::new(
                StorageKey::Bets.try_to_vec().unwrap()
            ),
            stakes: UnorderedMap::new(
                StorageKey::Stakes.try_to_vec().unwrap()
            ),
            cancelled_stakes: UnorderedMap::new(
                StorageKey::StakesCancelled.try_to_vec().unwrap()
            ),
        };

        this.measure_max_storage_cost_per_bet();
        this.measure_max_storage_cost_per_stake();

        this
    }

    pub fn metadata(&self) -> ContractMetadata {
        self.metadata.get().unwrap()
    }

    #[private] // no-production
    pub fn clean(keys: Vec<Base64VecU8>) { // no-production
        for key in keys.iter() { // no-production
            env::storage_remove(&key.0); // no-production
        } // no-production
    } // no-production

    fn measure_max_storage_cost_per_bet(&mut self) {
        let initial_storage_usage = env::storage_usage();
        let tmp_bet_id = "a".repeat(21).parse().unwrap();
        let person: Person = "a".repeat(32).parse().unwrap(); // cid length to persons photo(s) and/or other identifying content
        let tmp_bet = Bet {
            prediction: Prediction::Reduction,
            person: person.clone(),
            end: env::block_timestamp() + env::block_height(),
            motion_id: None,
        };
        self.persons.insert(&person);
        self.bets.insert(&tmp_bet_id, &tmp_bet);
        self.extra_storage_in_bytes_per_bet = env::storage_usage() - initial_storage_usage;
        self.bets.remove(&tmp_bet_id);
        self.persons.remove(&person);
    }

    fn measure_max_storage_cost_per_stake(&mut self) {
        let initial_storage_usage = env::storage_usage();
        let tmp_bet_id = "a".repeat(21).parse().unwrap();
        let tmp_stake_id = "a".repeat(21).parse().unwrap();
        let tmp_account_id = "a".repeat(64).parse().unwrap();
        let tmp_stake = &Stake {
            bet_id: tmp_bet_id,
            position: Position::Lay,
            amount: MIN_STAKE * 1000,
            staker: tmp_account_id,
            unmatched: MIN_STAKE * 1000,
            gentlemans: false,
            epoch: env::epoch_height(),
        };
        self.stakes.insert(&tmp_stake_id, tmp_stake);
        self.extra_storage_in_bytes_per_stake = env::storage_usage() - initial_storage_usage;
        self.stakes.remove(&tmp_stake_id);
    }
}
