use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedSet};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, log, near_bindgen, AccountId, Balance, CryptoHash, PanicOnDefault, Promise, StorageUsage
};

use crate::internal::*;
pub use crate::motion::*;
pub use crate::registration::*;
pub use crate::vote::*;

mod internal;
mod motion;
mod registration;
mod vote;

pub const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
#[cfg(not(near_testnet))]
const DELAY: u64 = 1 * 86_400_000_000_000; // 1 day

#[cfg(near_testnet)]
const DELAY: u64 = 3_000_000_000; // 1 second, just enough time for testing delay.

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub voters: Vec<Voter>,
    pub motions: UnorderedSet<Motion>,
    pub voters_per_motion: LookupMap<MotionId, UnorderedSet<Voter>>,

    /// The storage size in bytes for one motion.
    pub extra_storage_in_bytes_per_motion: StorageUsage,
}
#[derive(BorshSerialize)]
pub enum StorageKey {
    Vote { voter_id_hash: CryptoHash, value: Option<VoteValue> },
    Voter { account_id: AccountId, vote: Option<Vote> },
    Voters { motion_id: MotionId },
    Motions,
    VotersPerMotion,
    VotersPerMotionInner { voters: UnorderedSet<Voter> },
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        let mut this = Self {
            owner_id,
            voters: vec![],
            motions: UnorderedSet::new(StorageKey::Motions.try_to_vec().unwrap()),
            voters_per_motion: LookupMap::new(StorageKey::VotersPerMotion.try_to_vec().unwrap()),
            extra_storage_in_bytes_per_motion: 0,
        };

        this.measure_typical_motion_storage_cost();

        this
    }

    fn measure_typical_motion_storage_cost(&mut self) {
        let initial_storage_usage = env::storage_usage();
        let storage_usage_before_voter = env::storage_usage();
        self.voters.insert(0, Voter { account_id: env::signer_account_id(), vote: None, status: VoterStatus::UNREGISTERED });
        Voter::vote(self.voters.clone(), &env::signer_account_id(), Some(false));
        let storage_usage_after_voter = env::storage_usage();
        let motion_id = timestamp().to_string();
        let voters = UnorderedSet::new(StorageKey::Voters { motion_id: motion_id.clone() }.try_to_vec().unwrap());
        self.voters_per_motion.insert(
            &motion_id,
            &UnorderedSet::new(
                StorageKey::VotersPerMotionInner {
                    voters
                }
                .try_to_vec()
                .unwrap(),
            ),
        );

        let storage_per_motion_in_bytes = env::storage_usage() - initial_storage_usage;
        let storage_per_voter_in_bytes = storage_usage_after_voter - storage_usage_before_voter;

        self.extra_storage_in_bytes_per_motion =
            storage_per_motion_in_bytes + storage_per_voter_in_bytes;

        self.voters_per_motion.remove(&motion_id);
        self.voters.remove(0);
    }
}
