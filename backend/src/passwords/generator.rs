//! Strong passwords from the operating system's random source, and a rough
//! strength rating for the ones already saved.

use chacha20poly1305::aead::{OsRng, rand_core::RngCore};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const LOWER: &str = "abcdefghijklmnopqrstuvwxyz";
const UPPER: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &str = "0123456789";
const SYMBOLS: &str = "!@#$%^&*()-_=+[]{};:,.?/~";
/// Easy to mistake for one another when read or typed by hand.
const AMBIGUOUS: &str = "Il1O0o|`'\";:,.";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub length: usize,
    pub lower: bool,
    pub upper: bool,
    pub digits: bool,
    pub symbols: bool,
    #[serde(default)]
    pub avoid_ambiguous: bool,
}

/// A uniformly random number below `bound`, without modulo bias.
fn below(bound: usize) -> usize {
    let bound = bound as u64;
    let zone = u64::MAX - (u64::MAX % bound);
    loop {
        let value = OsRng.next_u64();
        if value < zone {
            return (value % bound) as usize;
        }
    }
}

pub fn generate(options: &Options) -> Result<Zeroizing<String>, String> {
    let length = options.length.clamp(8, 128);
    let keep = |set: &str| -> Vec<char> {
        set.chars()
            .filter(|c| !options.avoid_ambiguous || !AMBIGUOUS.contains(*c))
            .collect()
    };
    let sets: Vec<Vec<char>> = [
        (options.lower, LOWER),
        (options.upper, UPPER),
        (options.digits, DIGITS),
        (options.symbols, SYMBOLS),
    ]
    .into_iter()
    .filter(|(on, _)| *on)
    .map(|(_, set)| keep(set))
    .filter(|set| !set.is_empty())
    .collect();
    if sets.is_empty() {
        return Err("Choose at least one kind of character.".into());
    }
    let all: Vec<char> = sets.iter().flatten().copied().collect();

    // One from every chosen kind, the rest from all of them, then shuffled.
    let mut chars: Zeroizing<Vec<char>> = Zeroizing::new(Vec::with_capacity(length));
    for set in &sets {
        chars.push(set[below(set.len())]);
    }
    while chars.len() < length {
        chars.push(all[below(all.len())]);
    }
    for i in (1..chars.len()).rev() {
        chars.swap(i, below(i + 1));
    }
    Ok(Zeroizing::new(chars.iter().collect()))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Strength {
    None,
    Weak,
    Fair,
    Strong,
}

/// Bits of guessing from the length and the kinds of characters used,
/// halved for passwords made of one repeated or sequential run.
pub fn strength(password: &str) -> Strength {
    if password.is_empty() {
        return Strength::None;
    }
    let mut pool = 0u32;
    if password.chars().any(|c| c.is_ascii_lowercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_uppercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_digit()) {
        pool += 10;
    }
    if password.chars().any(|c| !c.is_ascii_alphanumeric()) {
        pool += 33;
    }
    let length = password.chars().count() as f64;
    let mut bits = length * f64::from(pool.max(1)).log2();
    let chars: Vec<char> = password.chars().collect();
    let repetitive = chars.windows(2).all(|w| w[0] == w[1])
        || chars
            .windows(2)
            .all(|w| (w[1] as i64 - w[0] as i64).abs() == 1);
    if repetitive {
        bits /= 2.0;
    }
    match bits {
        b if b < 45.0 => Strength::Weak,
        b if b < 75.0 => Strength::Fair,
        _ => Strength::Strong,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(length: usize) -> Options {
        Options {
            length,
            lower: true,
            upper: true,
            digits: true,
            symbols: true,
            avoid_ambiguous: false,
        }
    }

    #[test]
    fn generated_passwords_have_every_chosen_kind_and_the_asked_length() {
        for _ in 0..200 {
            let password = generate(&options(12)).unwrap();
            assert_eq!(password.chars().count(), 12);
            assert!(password.chars().any(|c| c.is_ascii_lowercase()));
            assert!(password.chars().any(|c| c.is_ascii_uppercase()));
            assert!(password.chars().any(|c| c.is_ascii_digit()));
            assert!(password.chars().any(|c| SYMBOLS.contains(c)));
        }
        let mut plain = options(200);
        plain.symbols = false;
        plain.avoid_ambiguous = true;
        let password = generate(&plain).unwrap();
        assert_eq!(password.chars().count(), 128, "clamped");
        assert!(
            !password
                .chars()
                .any(|c| AMBIGUOUS.contains(c) || SYMBOLS.contains(c))
        );
        let none = Options {
            lower: false,
            upper: false,
            digits: false,
            symbols: false,
            ..options(16)
        };
        assert!(generate(&none).is_err());
    }

    #[test]
    fn strength_reflects_length_variety_and_patterns() {
        assert_eq!(strength(""), Strength::None);
        assert_eq!(strength("password"), Strength::Weak);
        assert_eq!(strength("abcdefghijklmnop"), Strength::Weak);
        assert_eq!(strength("Tr0ub4dor&3"), Strength::Fair);
        assert_eq!(strength(&generate(&options(20)).unwrap()), Strength::Strong);
    }
}
