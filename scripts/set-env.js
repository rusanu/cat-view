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
    accessKeyId: '${envConfig.AWS_ACCESS_KEY_ID || ''}',
    secretAccessKey: '${envConfig.AWS_SECRET_ACCESS_KEY || ''}',
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

// Check if .env exists and has values
if (!fs.existsSync('.env')) {
  console.warn('⚠ Warning: .env file not found. Using default/empty values.');
  console.warn('  Copy .env.example to .env and fill in your AWS credentials.');
}
