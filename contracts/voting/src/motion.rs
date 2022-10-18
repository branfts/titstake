use crate::*;
use near_sdk::json_types::U128;
use near_sdk::Timestamp;

pub type MotionId = String;


#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum MotionStatus {
    OPEN,
    CLOSED,
    ADOPTED,
    REJECTED,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Motion {
    pub motion_id: MotionId,
    pub category: Option<String>,
    pub description: String,
    pub status: MotionStatus,
    pub registered: Vec<VoterId>,
    pub log: Vec<Log>,
    pub quorum: Option<u32>,
    pub end: Option<Timestamp>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonMotion {
    pub motion: Motion,
    pub voters: Vec<Voter>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Log {
    pub status: MotionStatus,
    pub timestamp: Timestamp,
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn motions(
        &mut self,
        params_vec: Vec<(
            Option<String>,
            String,
            Option<VoteValue>,
            Option<u32>,
            Option<Vec<AccountId>>
        )>
    ) -> Vec<Motion> {
        assert_one_yocto();
        assert!(self.is_registered(), "You must be registered.");

        params_vec.iter().map(|params| {
            self.internal_post_assert_motion(
                params.0.clone(),
                params.1.clone(),
                params.2.clone(),
                params.3.clone(),
                params.4.clone()
            )
        })
        .collect()
    }

    #[payable]
    pub fn motion(&mut self, category: Option<String>, description: String, value: Option<VoteValue>, quorum: Option<u32>, pool: Option<Vec<AccountId>>) -> Motion {
        assert_one_yocto();
        assert!(self.is_registered(), "You must be registered.");

        self.internal_post_assert_motion(category, description, value, quorum, pool)
    }
    
    #[private]
    pub fn internal_post_assert_motion(&mut self, category: Option<String>, description: String, value: Option<VoteValue>, quorum: Option<u32>, pool: Option<Vec<AccountId>>) -> Motion {
        let motion_id = timestamp().to_string();
        let motion = Motion {
            motion_id: motion_id.clone(),
            category,
            description,
            status: MotionStatus::OPEN,
            registered: self.voters.iter().fold(vec![], |mut acc, v| {
                if v.status == VoterStatus::REGISTERED {
                    if let Some(pool) = &pool {
                        if pool.contains(&v.account_id.clone()) {
                            acc.insert(0, v.account_id.clone());
                        }
                    } else {
                        acc.insert(0, v.account_id.clone());
                    }
                }
                acc
            }),
            end: None,
            log: vec![],
            quorum,
        };

        let voter = Voter::vote(self.voters.clone(), &env::signer_account_id(), value);
        let mut voters = UnorderedSet::new(
            StorageKey::Voters {
                motion_id: motion_id.clone(),
            }
            .try_to_vec()
            .unwrap(),
        );
        voters.insert(&voter);
        self.motions.insert(&motion);
        self.voters_per_motion.insert(&motion_id, &voters);

        self.tally_votes(&motion_id);

        motion
    }
    pub fn view_motion_by_description(&self, description: &String) -> Option<JsonMotion> {
        let motion = self.motions.iter().find(|motion| {
            log!("view_motion_by_description(): motion_id: {:?} == {}, {}", &motion.description, description, motion.description.eq(description));
            motion.description.eq(description)
        });

        if let Some(motion) = motion {
            let voters = self.voters_per_motion.get(&motion.motion_id);
            self.json_motion(Some(motion), voters)
        } else {
            None
        }
    }
    pub fn view_motions(
        &self,
        from_index: Option<U128>,
        limit: Option<u64>,
        motion_ids: Option<Vec<MotionId>>,
        category: Option<String>
    ) -> Option<Vec<JsonMotion>> {
        let start = u128::from(from_index.unwrap_or(U128(0)));

        self.motions.iter()
            .filter(|motion| motion_ids.is_none() || motion_ids.as_ref().unwrap().contains(&motion.motion_id.clone()))
            .filter(|motion| category.is_none() || motion.category.as_ref().is_some() && motion.category.as_ref().unwrap() == category.as_ref().unwrap())
            //skip to the index we specified in the start variable
            .skip(start as usize)
            //take the first "limit" elements in the vector. If we didn't specify a limit, use 50
            .take(limit.unwrap_or(50) as usize)
            .map(|motion| self.json_motion(Some(motion.clone()), self.voters_per_motion.get(&motion.motion_id)))
            .collect()
    }
    fn json_motion(&self, motion: Option<Motion>, voters: Option<UnorderedSet<Voter>>) -> Option<JsonMotion> {
        if let Some(motion) = motion {
            if let Some(voters) = voters {
                Some(JsonMotion {
                    motion,
                    voters: voters.to_vec(),
                })
            } else {
                Some(JsonMotion {
                    motion,
                    voters: vec![]
                })
            }
        } else {
            None
        }        
    }
}
