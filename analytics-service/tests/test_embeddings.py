import unittest
from unittest.mock import MagicMock, patch

import numpy as np
from fastapi.testclient import TestClient

from embeddings import EMBEDDING_DIMENSION, embed_text
from main import app


class TestEmbedText(unittest.TestCase):
    def test_rejects_blank_text(self):
        with self.assertRaises(ValueError):
            embed_text("   ")

    @patch("embeddings._load_model")
    def test_returns_float_list_with_expected_dimension(self, mock_load_model):
        mock_model = MagicMock()
        mock_model.encode.return_value = np.ones(EMBEDDING_DIMENSION, dtype=np.float32)
        mock_load_model.return_value = mock_model

        result = embed_text("hello")
        self.assertEqual(len(result), EMBEDDING_DIMENSION)
        self.assertTrue(all(isinstance(v, float) for v in result))
        mock_model.encode.assert_called_once_with("hello", normalize_embeddings=True)


class TestEmbedEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("main.embed_text")
    def test_post_ai_embed_returns_embedding_and_dimension(self, mock_embed_text):
        mock_embed_text.return_value = [0.1, 0.2, 0.3]
        with patch("main.EMBEDDING_DIMENSION", 3):
            response = self.client.post(
                "/ai/embed",
                json={
                    "text": "Our return policy allows customers to return products within 30 days.",
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["dimension"], 3)
        self.assertEqual(body["embedding"], [0.1, 0.2, 0.3])
        mock_embed_text.assert_called_once_with(
            "Our return policy allows customers to return products within 30 days.",
        )


if __name__ == "__main__":
    unittest.main()
