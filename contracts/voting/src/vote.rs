use crate::*;

pub type VoteValue = bool;
pub type VoterId = AccountId;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, Clone, PartialOrd, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum VoterStatus {
    REGISTERED,
    UNREGISTERED
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, PartialEq, PartialOrd, Clone
)]
#[serde(crate = "near_sdk::serde")]
pub struct Vote {
    pub voter_id_hash: CryptoHash,
    pub value: Option<VoteValue>,
}

#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Debug, PartialEq, PartialOrd, Clone
)]
#[serde(crate = "near_sdk::serde")]
pub struct Voter {
    pub account_id: AccountId,
    pub vote: Option<Vote>,
    pub status: VoterStatus,
}

impl Voter {
    pub fn vote(voters: Vec<Voter>, voter_id: &AccountId, value: Option<VoteValue>) -> Voter {
        let mut voter = voters.clone().into_iter()
            .find(|voter| &voter.account_id == voter_id)
            .expect(format!("Voter {} not found!", &voter_id).as_str());

        voter.vote = Some(Vote::new(voter_id, value));

        voter.clone()
    }
}

impl Vote {
    pub fn new(voter_id: &AccountId, value: Option<VoteValue>) -> Vote {
        let mut vote_value = None;
        if let Some(value) = value {
            vote_value = Some(VoteValue::from(value));
        }
        Vote {
            voter_id_hash: hash_account_id(voter_id),
            value: vote_value,
        }
    }
}

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn vote(&mut self, motion_id: MotionId, value: VoteValue) -> Vote {
        assert_one_yocto();

        assert!(
            self.is_registered(),
            "User {} is not registered.",
            env::signer_account_id()
        );

        let motion: Option<Motion> = self
            .motions
            .iter()
            .find(|motion| motion.motion_id.eq(&motion_id));

        assert!(
            motion.is_some(),
            "Motion with id: {}, not found!",
            motion_id
        );

        assert_eq!(
            motion.as_ref().unwrap().status,
            MotionStatus::OPEN,
            "Motion {} is not OPEN.",
            motion_id
        );

        log!(" {:?}", motion.as_ref().unwrap());
        assert!(
            motion.as_ref().unwrap().registered.contains(&env::signer_account_id()),
            "Not registered in this voting pool."
        );

        let voter = Voter::vote(self.voters.clone(), &env::signer_account_id(), Some(value));

        let mut voters = self.voters_per_motion.get(&motion_id);
        if voters.is_none() {
            voters = Some(UnorderedSet::new(StorageKey::Voters { motion_id: motion_id.clone() }.try_to_vec().unwrap()));
        }
        if let Some(mut voters) = voters {
            let voted = voters.iter().find(|v| &v.account_id == &voter.account_id);
            if let Some(voted) = voted {
                assert!(
                    false,
                    "Voter {} already voted: {:?}",
                    voted.account_id,
                    voted.vote.unwrap().value.unwrap()
                );
            }
            voters.insert(&voter);
            self.voters_per_motion.insert(&motion_id, &voters);
        }

        self.tally_votes(&motion_id);

        voter.vote.unwrap()
    }
    pub fn tally_votes(
        &mut self,
        motion_id: &MotionId,
    ) {
        let mut yes_votes = 0;
        let mut no_votes = 0;
    
        let voters = self.voters_per_motion.get(motion_id).unwrap();

        for voter in voters.iter() {
            let vote = voter.vote;
            if let Some(vote) = vote {
                let value = vote.value;
                if let Some(value) = value {
                    if value {
                        yes_votes += 1;
                    } else {
                        no_votes += 1;
                    }
                } else {
                    no_votes += 1
                }
            }
        }
        let mut motion: Motion = self.motions
            .iter()
            .find(|motion| &motion.motion_id == motion_id)
            .expect("Motion not found!");
    
        
        let majority_vote_count = (motion.registered.len() / 2 + 1) as u32;

        log!("yes votes: {}", &yes_votes); // no-production
        log!("no votes: {}", &no_votes); // no-production
        log!("majority_vote_count: {}", majority_vote_count); // no-production

        self.motions.remove(&motion);
        if motion.quorum.is_some() {
            let now = env::block_timestamp() + env::block_index();
            let quorum = motion.quorum.unwrap();
            let total_votes = yes_votes + no_votes;
            let unanimous = (yes_votes == 0 || no_votes != 0) || (yes_votes != 0 || no_votes == 0);
            let end = motion.end.unwrap_or_else(|| {
                let timestamp = now + DELAY;
                motion.end = Some(timestamp.clone());
                return timestamp;
            });

            log!(
                "quorum tally, total_votes: {}, quorum: {}, now: {}, end: {}, unanimous: {}",
                total_votes.clone(),
                quorum.clone(),
                now.clone(),
                end.clone(),
                unanimous.clone()
            ); // no-production
            if total_votes >= quorum && (now >= end) && unanimous {
                if yes_votes > no_votes {
                    internal::update_motion_status(&mut motion, MotionStatus::ADOPTED);
                } else {
                    internal::update_motion_status(&mut motion, MotionStatus::REJECTED);
                }
            }
        } else {
            if yes_votes >= majority_vote_count {
                internal::update_motion_status(&mut motion, MotionStatus::ADOPTED);
                for voter in self.voters.iter_mut().filter(|voter| voter.status == VoterStatus::UNREGISTERED) {
                    if motion.description.eq(&format!("Add {} as a registered user.", voter.account_id)) {
                        voter.status = VoterStatus::REGISTERED;
                    }
                }
            } else if no_votes >= majority_vote_count {
                internal::update_motion_status(&mut motion, MotionStatus::REJECTED);
            }
        }
        self.motions.insert(&motion);
    }
}
