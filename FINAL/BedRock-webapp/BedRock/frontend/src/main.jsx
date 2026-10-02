import { createRoot } from "react-dom/client";
import { Amplify } from "aws-amplify";
import App from "./app/App.jsx";
import "./styles/index.css";

// Configure Amplify for AWS Rekognition Liveness (guest access via Cognito Identity Pool)
const region = import.meta.env.VITE_AWS_REGION;
const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

if (region && identityPoolId) {
  Amplify.configure({
    Auth: {
      Cognito: {
        identityPoolId,
        allowGuestAccess: true,
      },
    },
  });
}

createRoot(document.getElementById("root")).render(<App />);
