fn main(secret: Field, public_commitment: pub Field) {
    let computed = std::hash::pedersen_hash([secret]);
    assert(computed == public_commitment);
}
