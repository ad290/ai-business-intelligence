from decimal import Decimal

from value_format import normalize_json_value, normalize_numeric


def test_whole_float_becomes_int() -> None:
    assert normalize_numeric(400.0) == 400


def test_decimal_whole_becomes_int() -> None:
    assert normalize_numeric(Decimal("400.00")) == 400


def test_fractional_stays_float() -> None:
    assert normalize_numeric(12.5) == 12.5


def test_nested_result_normalization() -> None:
    assert normalize_json_value([{"max_sales": 400.0}]) == [{"max_sales": 400}]
