# Bitbucket Environment Variables Setup Guide

## Required Environment Variables

You need to add these environment variables in your Bitbucket repository settings:
**Settings → Repository settings → Pipelines → Repository variables**

### 1. DOCKER_HUB_USERNAME
- **Value**: `leehyeontae` (or your Docker Hub username)
- **Description**: Docker Hub username for pushing images
- **Secured**: No

### 2. DOCKER_HUB_PASSWORD
- **Value**: Your Docker Hub access token (NOT your password)
- **Description**: Docker Hub access token for authentication
- **Secured**: Yes ✓
- **How to get**: 
  1. Go to https://hub.docker.com/settings/security
  2. Click "New Access Token"
  3. Name it "bitbucket-ci"
  4. Copy the generated token

### 3. CONFIG_REPO_URL
- **Value**: `git@bitbucket.org:inhuman-z/local_k8s.git`
- **Description**: Config repository URL for GitOps
- **Secured**: No

### 4. CONFIG_REPO_SSH_KEY
- **Value**: Your Base64-encoded SSH private key (see below)
- **Description**: SSH private key for accessing Config repository
- **Secured**: Yes ✓
- **Your encoded key**:
```
LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQ21GbGN6STFOaTFqZEhJQUFBQUdZbU55ZVhCMEFBQUFHQUFBQUJBUVlKeklGOAoyVmRpcGUyTFpHZ0Q5UkFBQUFHQUFBQUFFQUFBQXpBQUFBQzNOemFDMWxaREkxTlRFNUFBQUFJSUU5eDRzRFVWUmRON21XCk1ROTYwVzRYaVhQcjg4bW56SDlBVXdyNW9PMTNBQUFBb0srYUMwbDdIdkZNbGJRdEc2SndYZDBMWHZVeldEZjAzN1dYQTQKSFhncmdsSGs5Q240bVRtU0E0emxydVBUNXFnUnRPSkhydlpoaVFKOWxQdTdIUTRUSlVXYUJsaDdQRkpMUmhGZndZYnRaSwpWQi8vZXV2RjZ0eXFrNzAxcmRreTg1T3JnS3d5SkJEei9VcDM1NkMydmRIZVZiaHNMa1NINkM3NTBVNm5rSk1TY2VSa1krCmVraXBEUUtVTDlhMmJYYzBCdTBPZGR1eVFXZ1AzY1p3TERSLzQ9Ci0tLS0tRU5EIE9QRU5TU0ggUFJJVkFURSBLRVktLS0tLQo=
```

### 5. GIT_USER_EMAIL
- **Value**: `your-email@example.com`
- **Description**: Git commit email for CI
- **Secured**: No

### 6. GIT_USER_NAME
- **Value**: `CI Pipeline`
- **Description**: Git commit author name
- **Secured**: No

## Why CONFIG_REPO_SSH_KEY is needed?

The `CONFIG_REPO_SSH_KEY` environment variable is essential because:

1. **Authentication**: The CI pipeline needs to authenticate with the Config repository (local_k8s) to push updates
2. **Security**: We can't use your personal SSH keys directly in the pipeline for security reasons
3. **Automation**: The pipeline runs in an isolated container that doesn't have access to your local SSH keys
4. **GitOps Workflow**: To update Helm values in the Config repository, the pipeline needs write access

### The CI/CD Flow:
```
1. Pipeline starts in Bitbucket cloud
2. Builds and pushes Docker images
3. Needs to clone local_k8s repository ← Requires SSH authentication
4. Updates Helm values with new image tags
5. Pushes changes back to local_k8s ← Requires SSH write access
6. This triggers ArgoCD webhook to sync
```

## Step-by-Step Setup Instructions

1. **Go to Bitbucket Repository Settings**
   ```
   https://bitbucket.org/inhuman-z/k6-testing-platform/admin/addon/admin/pipelines/repository-variables
   ```

2. **Add each variable**:
   - Click "Add variable"
   - Enter the Name and Value
   - Check "Secured" for sensitive values (passwords, keys)
   - Click "Add"

3. **Verify all variables are added**:
   - You should see 6 variables in the list
   - Secured variables will show as `*****`

## Testing the Setup

After adding all environment variables:

1. Make a small change in your code
2. Commit and push to main branch:
   ```bash
   git add .
   git commit -m "Test CI/CD pipeline"
   git push origin main
   ```

3. Check the pipeline execution:
   ```
   https://bitbucket.org/inhuman-z/k6-testing-platform/pipelines
   ```

## Troubleshooting

### If pipeline fails with "Permission denied (publickey)"
- Verify the SSH key is correctly encoded in Base64
- Check that the public key is added to local_k8s Access keys

### If Docker push fails
- Verify DOCKER_HUB_PASSWORD is an access token, not your password
- Check Docker Hub rate limits

### If Config repo update fails
- Verify CONFIG_REPO_URL is correct
- Check that the SSH key has write access to local_k8s

## Security Notes

- **Never commit secrets to Git**
- **Use secured variables** for sensitive data
- **Rotate tokens regularly** (every 90 days)
- **Use access tokens** instead of passwords
- **Limit token scope** to only what's needed