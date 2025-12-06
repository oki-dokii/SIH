from sentence_transformers import SentenceTransformer
import os

# Define local path
local_model_path = os.path.join(os.getcwd(), "local_models", "all-MiniLM-L6-v2")

# Create directory
os.makedirs(local_model_path, exist_ok=True)

print(f"Downloading model to {local_model_path}...")

# Download and save
model = SentenceTransformer('all-MiniLM-L6-v2')
model.save(local_model_path)

print("Download complete! You can now run offline.")
