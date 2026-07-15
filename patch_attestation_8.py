import re

with open("integrity-sdk/tests/test_attestation.py", "r") as f:
    data = f.read()

replacement = """def test_validity_period_check_passes_at_a_reference_time_inside_the_real_window(real_document_bytes):
    # November 2022, per verify_nitro_attestation's own docstring on this fixture's age.
    reference_time = datetime(2022, 11, 10, tzinfo=timezone.utc)
    result = attestation.verify_nitro_attestation(
        real_document_bytes, enforce_validity_period=True, reference_time=reference_time
    )

    assert result.validity_period_valid is True, result.errors
    assert result.valid is True, result.errors"""

match_str = """def test_validity_period_check_passes_at_a_reference_time_inside_the_real_window(real_document_bytes):
    # November 2022, per verify_nitro_attestation's own docstring on this fixture's age.
    reference_time = datetime(2022, 11, 15, tzinfo=timezone.utc)
    result = attestation.verify_nitro_attestation(
        real_document_bytes, enforce_validity_period=True, reference_time=reference_time
    )

    assert result.validity_period_valid is True, result.errors
    assert result.valid is True, result.errors"""

data = data.replace(match_str, replacement)

with open("integrity-sdk/tests/test_attestation.py", "w") as f:
    f.write(data)
