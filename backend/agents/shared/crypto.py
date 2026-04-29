"""
Ed25519 signing and verification for agent bid messages.
Uses the standard `cryptography` library.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    PrivateFormat,
    NoEncryption,
    load_pem_private_key,
)


def load_private_key(pem_path: str | Path) -> Ed25519PrivateKey:
    """Load an ed25519 private key from a PEM file."""
    data = Path(pem_path).read_bytes()
    return load_pem_private_key(data, password=None)


def get_public_key_hex(private_key: Ed25519PrivateKey) -> str:
    """Derive the hex-encoded public key from a private key."""
    pub = private_key.public_key()
    raw = pub.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return raw.hex()


def sign_message(private_key: Ed25519PrivateKey, data: dict) -> str:
    """
    Sign a canonical JSON-serialised dict and return hex signature.
    The dict is sorted by key for canonical form.
    """
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    raw = canonical.encode()
    sig = private_key.sign(raw)
    return sig.hex()


def verify_signature(public_key_hex: str, data: dict, signature_hex: str) -> bool:
    """Verify a hex-encoded ed25519 signature against a dict."""
    try:
        pub_raw = bytes.fromhex(public_key_hex)
        pub: Ed25519PublicKey = Ed25519PublicKey.from_public_bytes(pub_raw)
        canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
        sig = bytes.fromhex(signature_hex)
        pub.verify(sig, canonical.encode())
        return True
    except Exception:
        return False


def sha256_hex(content: str | bytes) -> str:
    """Return the SHA-256 hex digest of content."""
    if isinstance(content, str):
        content = content.encode()
    return hashlib.sha256(content).hexdigest()
