const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envConfig = dotenv.config().parsed || {};

// Template for environment files
const generateEnvFile = (production) => `// This file is auto-generated from .env - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
export const environment = {
  production: ${production},
  aws: {
    region: '${envConfig.AWS_REGION || 'us-east-1'}',
    bucketName: '${envConfig.AWS_BUCKET_NAME || ''}',
    bucketFolder: '${envConfig.AWS_BUCKET_FOLDER || ''}',
    bucketFavouritesFolder: '${envConfig.AWS_BUCKET_FAVOURITES_FOLDER || ''}',
  },
  google: {
    clientId: '${envConfig.GOOGLE_CLIENT_ID || ''}',
  },
  cognito: {
    identityPoolId: '${envConfig.COGNITO_IDENTITY_POOL_ID || ''}',
  }
};
`;

// Create environments directory if it doesn't exist
const envDir = './src/environments';
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Generate environment files
fs.writeFileSync(`${envDir}/environment.ts`, generateEnvFile(true));
fs.writeFileSync(`${envDir}/environment.development.ts`, generateEnvFile(false));

console.log('✓ Environment files generated from .env');

// Check if .env exists and has required values
if (!fs.existsSync('.env')) {
  console.warn('⚠ Warning: .env file not found. Using default/empty values.');
  console.warn('  Copy .env.example to .env and fill in your configuration.');
} else {
  // Validate required fields
  const requiredFields = ['GOOGLE_CLIENT_ID', 'COGNITO_IDENTITY_POOL_ID'];
  const missingFields = requiredFields.filter(field => !envConfig[field]);

  if (missingFields.length > 0) {
    console.warn('⚠ Warning: Missing required environment variables:');
    missingFields.forEach(field => console.warn(`  - ${field}`));
    console.warn('  Please update your .env file. See .env.example for reference.');
  }
}
