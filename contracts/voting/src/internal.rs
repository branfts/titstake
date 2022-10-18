use crate::*;

use near_sdk::Timestamp;

pub(crate) fn timestamp() -> Timestamp {
    env::block_timestamp() + env::block_index()
}

pub(crate) fn hash_account_id(account_id: &AccountId) -> CryptoHash {
    let mut hash = CryptoHash::default();
    hash.copy_from_slice(&env::sha256(account_id.as_bytes()));
    hash
}

pub(crate) fn assert_one_yocto() {
    assert_eq!(
        env::attached_deposit(),
        1,
        "Requires attached deposit of exactly 1 yoctoNEAR",
    )
}

pub(crate) fn assert_min_one_near() {
    assert!(
        env::attached_deposit() >= ONE_NEAR,
        "Requires attached deposit of at least 1 NEAR",
    )
}

pub(crate) fn refund_deposit(storage_used: u64) {
    let required_cost = env::storage_byte_cost() * Balance::from(storage_used);
    let attached_deposit = env::attached_deposit();

    assert!(
        required_cost <= attached_deposit,
        "Must attach {} yoctoNEAR to cover storage",
        required_cost,
    );

    let refund = attached_deposit - required_cost;
    if refund > 1 {
        Promise::new(env::predecessor_account_id()).transfer(refund);
    }
}

pub(crate) fn update_motion_status(motion: &mut Motion, status: MotionStatus) {
    motion.status = status.clone();
    motion.log.push(Log {
        status,
        timestamp: timestamp()
    });
}

impl Contract {
    pub(crate) fn internal_motion(
        &mut self,
        category: Option<String>,
        description: String,
    ) -> Motion {
        let motion_id = timestamp().to_string();
        let motion = Motion {
            motion_id,
            category,
            description,
            status: MotionStatus::OPEN,
            registered: self.voters.iter().fold(vec![], |mut acc, v| {
                if v.status == VoterStatus::REGISTERED {
                    acc.insert(0, v.account_id.clone());
                }
                acc
            }),
            log: vec![],
            end: None,
            quorum: None,
        };

        self.motions.insert(&motion);

        motion
    }
}