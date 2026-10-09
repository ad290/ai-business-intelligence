from column_inference import infer_column_type


def test_integer_sales_values_infer_as_number_not_date() -> None:
    assert infer_column_type(["100", "200", "1500"]) == "number"


def test_iso_dates_infer_as_date() -> None:
    assert infer_column_type(["2024-01-01", "2024-02-01"]) == "date"
