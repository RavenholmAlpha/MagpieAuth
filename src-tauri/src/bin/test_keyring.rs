use magpieauth_lib::crypto;

fn main() {
    println!("Testing DPAPI IMK Persistence...");

    match crypto::retrieve_imk() {
        Ok(key) => {
            println!("Successfully retrieved IMK! First byte: {}", key[0]);
        }
        Err(e) => println!("ERROR retrieving IMK: {:?}", e),
    }

    // Force a regenerate/store
    let new_imk = crypto::generate_imk();
    match crypto::store_imk(&new_imk) {
        Ok(_) => println!("Successfully saved new IMK via DPAPI!"),
        Err(e) => println!("ERROR saving IMK: {:?}", e),
    }
}
