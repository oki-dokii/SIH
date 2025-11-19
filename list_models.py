#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv 
# The module import below should now be correct if you have google-genai installed
from google import genai 


# 1. Load the environment variables from the .env file.
load_dotenv()

def list_models():
    # 2. Check for the key right away
    API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not API_KEY:
        print("Error: API Key not found in environment after loading .env. Check your .env file syntax!")
        sys.exit(1)

    print("Attempting to connect to Gemini API...")
    
    try:
        # 3. Pass the API Key explicitly to the client for guaranteed authentication
        client = genai.Client(api_key=API_KEY)
        
        print("Successfully connected to Gemini API.")
        print("Listing available models:")
        
        # Use the models.list() method
        # The list() function is actually a generator, so we iterate over it
        models = client.models.list()
        
        # Print the model names
        for m in models:
            # Check if 'name' exists before trying to access it
            if hasattr(m, 'name') and hasattr(m, 'display_name'):
                print(f"* {m.name} (Display: {m.display_name})")
            else:
                # Fallback print for unexpected object structure
                print(f"* Found model object: {m}")

    # Catch any general exception that might occur (API errors, network errors, etc.)
    except Exception as e:
        print(f"\n--- API or Connection Error ---")
        print(f"An error occurred: {type(e).__name__}: {e}")
        print("Possible causes: Invalid API Key, network issues, or a temporary service problem.")


if __name__ == "__main__":
    list_models()