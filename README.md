# REST API

This API (`test-express-js`) is an Express.js application integrated with Firebase Admin SDK, Firestore, and JWT-based authentication.

## Prerequisites

Ensure you have the following installed:
- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup Instructions

1. **Clone the Repository:**

    ```bash
    git clone https://github.com/NutriFish-C241-PS164/NutriFish-C241-PS164-CloudComputing.git
    cd test-express-js
    ```

2. **Install Dependencies:**

    ```bash
    npm install
    ```

3. **Environment Variables:**

    Create a `.env` file in the root directory and add the following variables:

    ```env
    PORT=8080
    JWT_SECRET=your_jwt_secret_key
    ```

4. **Service Account Key:**

    Obtain your Firebase service account key file from the Firebase Console and place it in the root directory of the project. Rename it to `service-account.json`.

5. **Running the Application:**

    ```bash
    npm start
    ```

    The application should now be running on `http://localhost:8080`.

## Project Structure

- `node_modules/` - Directory for installed npm packages.
- `.env` - Environment variables file.
- `.gcloudignore` - Files ignored by Google Cloud.
- `.gitignore` - Files ignored by git.
- `Dockerfile` - Docker configuration for containerizing the app.
- `firebase-admin-init.js` - Initialization script for Firebase Admin SDK.
- `index.js` - Main application file.
- `package-lock.json` - Lockfile for npm dependencies.
- `package.json` - Project manifest file.
- `service-account.json` - Firebase service account credentials.

## API Endpoints

### Authentication

- **POST `/verify-google-token`**: Verifies Google token and returns a JWT.
    - Request: `{ "idToken": "google_id_token" }`
    - Response: `{ "error": false, "message": "success", "token": "jwt_token" }`

- **POST `/register`**: Registers a new user.
    - Request: `{ "email": "user@example.com", "password": "password123", "name": "John Doe", "username": "johndoe" }`
    - Response: `{ "error": false, "message": "User registered successfully" }`

- **POST `/login`**: Logs in a user.
    - Request: `{ "email": "user@example.com", "password": "password123" }`
    - Response: `{ "error": false, "message": "success", "loginResult": { "username": "johndoe", "name": "John Doe", "token": "jwt_token", "userID": "user_id" } }`

### Stories

- **POST `/stories`**: Adds a new story. Requires JWT authentication.
    - Request: Form data with fields `storyTitle`, `storyDescription`, `lat`, `lon`, and `photo`.
    - Response: `{ "error": false, "message": "success", "storyID": "story_id" }`

- **GET `/stories`**: Retrieves all stories.
    - Request: Query parameters `page`, `size`, and `location`.
    - Response: `{ "error": false, "message": "Stories fetched successfully", "listStory": [...] }`

- **GET `/stories/:storyID`**: Retrieves a story by ID.
    - Request: `{ "storyID": "story_id" }`
    - Response: `{ "storyTitle": "title", "storyDescription": "description", ... }`

- **GET `/stories/user/:userID`**: Retrieves stories by user ID.
    - Request: `{ "userID": "user_id" }`
    - Response: `{ "error": false, "message": "User stories fetched successfully", "userStories": [...] }`

## Middleware

- **Authentication**: Middleware function `authenticateToken` verifies JWT tokens.
- **File Upload**: Middleware function `upload` handles file uploads with a limit of 1MB per file.

## Deployment

To deploy this application using Google Cloud Run:

1. **Authenticate with Google Cloud:**

    Ensure you have the Google Cloud SDK installed and authenticated:

    ```bash
    gcloud auth login
    gcloud config set project YOUR_PROJECT_ID
    ```

2. **Build and Submit the Docker Image:**

    Use Google Cloud Build to build and push the Docker image to Google Container Registry:

    ```bash
    gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/test-express-js
    ```

3. **Deploy to Cloud Run:**

    Deploy the container image to Cloud Run:

    ```bash
    gcloud run deploy test-express-js \
        --image gcr.io/YOUR_PROJECT_ID/test-express-js \
        --platform managed \
        --region YOUR_REGION \
        --allow-unauthenticated \
        --update-env-vars PORT=8080,JWT_SECRET=your_jwt_secret_key
    ```

    Replace `YOUR_PROJECT_ID` with your Google Cloud project ID and `YOUR_REGION` with your preferred region (e.g., `asia-southeast2`).

4. **Access the Service:**

    After deployment, Google Cloud Run will provide a service URL. You can use this URL to access your application.

    ```bash
    Deployment successful.
    Service URL: https://YOUR_SERVICE_URL/
    ```

5. **Setting Environment Variables:**

    If you need to update the environment variables after deployment, use the following command:

    ```bash
    gcloud run services update test-express-js \
        --update-env-vars JWT_SECRET=new_jwt_secret_key
    ```

6. **Firebase Service Account:**

    Ensure your `service-account.json` file is securely stored and referenced in your code. You might want to store it in a secure environment variable or use Google Secret Manager for enhanced security.

## License

This project is licensed under the MIT License.

## Full Code

Get the full code from the following Google Drive link:

[https://drive.google.com/drive/folders/1yfCsBFep-jX1qSUBwF_AYRKQYAEQpItL?usp=sharing](https://drive.google.com/drive/folders/1yfCsBFep-jX1qSUBwF_AYRKQYAEQpItL?usp=sharing)
