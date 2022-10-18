use crate::*;

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn register(&mut self) -> Vec<Voter> {
        assert_min_one_near();

        if self.user_exists() {
            refund_deposit(0);
            assert!(true, "User {} has already registered.", env::signer_account_id());
        } else {
            let mut status = VoterStatus::UNREGISTERED; // Allow the first 3 users to be auto registered without a voting process
            if self.voters.len() <= 2 {
                status = VoterStatus::REGISTERED
            } else {
                self.internal_motion(None, format!("Add {} as a registered user.", env::signer_account_id()));
            }
            self.voters.insert(0, Voter {
                account_id: env::signer_account_id(),
                vote: None,
                status
            });
            Promise::new(env::current_account_id()).transfer(ONE_NEAR);
            
            let refund = env::attached_deposit() - ONE_NEAR;

            if refund > 1 {
                Promise::new(env::predecessor_account_id()).transfer(refund);
            }
        }

        self.voters.to_vec()
    }
    
    pub fn registered(&self) -> Vec<Voter> {
        self.voters.to_vec()
    }

    pub fn is_registered(&self) -> bool {
        self.voters.iter().find(|user| user.account_id == env::signer_account_id() && user.status == VoterStatus::REGISTERED).is_some()
    }

    pub fn user_exists(&self) -> bool {
        self.voters.iter().find(|user| user.account_id == env::signer_account_id()).is_some()
    }
}
