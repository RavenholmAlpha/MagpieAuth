use std::time::{SystemTime, UNIX_EPOCH};
use totp_rs::{Algorithm, Secret, TOTP};

fn main() {
    let secret_str = "YBWH4PHSFLBIZWL2F7TKS475PGYTZRP6";
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Standard totp-rs usage (letting it handle padding)
    let secret = Secret::Encoded(secret_str.to_string());
    let totp_std = TOTP::new_unchecked(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().unwrap(),
        None,
        "".to_string(),
    );
    let code_std = totp_std.generate(now);

    // Our usage inside MagpieAuth
    let raw_secret = secret_str.to_string();
    let unpadded = raw_secret.trim_end_matches('=');
    let secret_bytes =
        base32::decode(base32::Alphabet::Rfc4648 { padding: false }, unpadded).unwrap();
    let totp_ours = TOTP::new_unchecked(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        None,
        "".to_string(),
    );
    let code_ours = totp_ours.generate(now);

    println!("Input Secret: {}", secret_str);
    println!("Standard code (totp-rs native payload): {}", code_std);
    println!("Our code (base32 stripped payload):     {}", code_ours);
    println!("Are they equal? {}", code_std == code_ours);
}
