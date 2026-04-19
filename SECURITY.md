# Security Policy

## Admin API Key Rotation

The Canopy Trove backend uses an Admin API Key for authenticated requests. This key must be rotated regularly to maintain security.

### Rotation Schedule

- **Frequency**: Every 90 days (quarterly)
- **Emergency**: Immediately if key is suspected to be compromised
- **Documentation**: Log all rotations in your infrastructure change log

### Key Storage

The Admin API Key is stored in Google Cloud Secret Manager:

- **Project**: `canopy-trove`
- **Secret Name**: `ADMIN_API_KEY`
- **Access**: Cloud Run service account only

### Rotation Procedure

#### Step 1: Generate a New API Key

1. Access your admin console or API key generation system
2. Generate a new API key with the appropriate permissions
3. Securely store the new key in a temporary secure location (e.g., password manager, encrypted notes)
4. Document the generation timestamp

#### Step 2: Update Google Secret Manager

1. Access Google Cloud Console → Secret Manager

   ```bash
   # Or via gcloud CLI
   gcloud secrets versions add ADMIN_API_KEY --data-file=- <<< "YOUR_NEW_API_KEY"
   ```

2. Verify the new version is created:

   ```bash
   gcloud secrets versions list ADMIN_API_KEY
   ```

3. Note the new version number

#### Step 3: Update Cloud Run Service

1. Redeploy the Cloud Run service to pick up the new secret:

   ```bash
   gcloud run deploy canopytrove-api \
     --region us-east4 \
     --update-env-vars ADMIN_API_KEY=projects/canopy-trove/secrets/ADMIN_API_KEY/versions/latest
   ```

2. Verify the deployment:

   ```bash
   gcloud run services describe canopytrove-api --region us-east4
   ```

3. Run health checks to confirm the service is responding correctly:
   ```bash
   curl https://canopytrove-api-XXXXX.run.app/healthz
   ```

#### Step 4: Revoke the Old API Key

1. Wait 5 minutes to allow all instances to fully receive the new key
2. Revoke the old API key in your admin console
3. Verify revocation was successful

#### Step 5: Document the Rotation

1. Record the rotation in your change log:
   - Date of rotation
   - New key version number
   - Name of operator who performed rotation
   - Any issues encountered

2. Update any runbooks or documentation that reference the key

### Emergency Rotation Procedure

If the Admin API Key is suspected to be compromised:

1. **Immediate**: Generate a new API key immediately
2. **Urgent Update**: Update Secret Manager with the new key (priority)

   ```bash
   gcloud secrets versions add ADMIN_API_KEY --data-file=- <<< "YOUR_EMERGENCY_KEY"
   ```

3. **Urgent Redeploy**: Redeploy Cloud Run immediately

   ```bash
   gcloud run deploy canopytrove-api \
     --region us-east4 \
     --update-env-vars ADMIN_API_KEY=projects/canopy-trove/secrets/ADMIN_API_KEY/versions/latest
   ```

4. **Revoke Compromised Key**: Revoke the old key in your admin console
5. **Audit**: Review API logs for suspicious activity during the compromise window
6. **Notify**: Alert relevant stakeholders of the security incident

### Verification Checklist

After rotation is complete, verify:

- [ ] New key is stored in Secret Manager
- [ ] Cloud Run service is running with the new key
- [ ] Health check endpoints respond successfully
- [ ] API requests using the old key fail
- [ ] API requests using the new key succeed
- [ ] No error logs indicating authentication failures
- [ ] Rotation is documented with timestamp and operator

### Backup and Recovery

If the new deployment fails after rotation:

1. Identify the issue from Cloud Run logs:

   ```bash
   gcloud run logs read canopytrove-api --region us-east4 --limit=50
   ```

2. Rollback to previous Cloud Run revision if needed:

   ```bash
   gcloud run services update-traffic canopytrove-api \
     --region us-east4 \
     --to-revisions PREVIOUS_REVISION=100
   ```

3. Investigate the root cause before attempting rotation again

### Key Best Practices

1. **Never share keys**: Admin API keys should never be shared or stored in code
2. **Secure transport**: Only transmit keys over encrypted channels (HTTPS, VPN, Secret Manager)
3. **Limited scope**: Use keys with minimal required permissions
4. **Monitoring**: Monitor Secret Manager for unauthorized access attempts
5. **Rotation tracking**: Maintain a secure log of all rotations with dates and operators

### Related Documentation

- [Google Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Cloud Run Service Account Permissions](https://cloud.google.com/run/docs/configuring/service-accounts)

### Contact & Escalation

If you encounter issues during key rotation:

1. Check Cloud Run logs for specific error messages
2. Verify Secret Manager permissions for the Cloud Run service account
3. Ensure the new key has the correct format and permissions
4. Contact infrastructure/DevOps team if issues persist

## iOS + Android Signing Credentials

The repo stores local signing credentials for EAS Build in two places:

- `credentials.json` (iOS distribution cert reference + keystore mappings)
- `credentials/android/` (Android keystore + key alias)

Both paths are already listed in `.gitignore` and have never been committed to
the repo history (verified 2026-04-19 via `git log --all --full-history`).
However, the local files still represent signing authority for the app. Treat
them like any other private key.

### Rotation / Migration to EAS-Managed Credentials

Recommended: move to EAS-managed credentials so the keys live in Expo's secure
storage instead of on the developer workstation.

```bash
# From the project root
npx eas credentials

# Select "iOS" -> production -> "Distribution Certificate" -> Generate new
# Select "Android" -> production -> "Keystore" -> Generate new (or upload existing)
# When prompted, choose "Use EAS to manage credentials"
```

After moving to EAS-managed:

1. Delete the local `credentials.json` and `credentials/` folder.
2. Verify the next `eas build --profile production` still succeeds without them.
3. If the previous local keys were ever exposed (e.g. backup sync, screen-share,
   leaked to a support thread), revoke the distribution certificate in the Apple
   Developer portal and rotate the Android keystore. Note: Android keystore
   rotation is **one-time** — once the store app is signed with a key, the same
   key must sign every subsequent update unless you use Play App Signing (which
   you should enable if not already).

### Current state (verified 2026-04-19)

- [x] `credentials.json` is in `.gitignore`
- [x] `credentials/` is in `.gitignore`
- [x] Neither path has ever been committed (`git log --all --full-history --` clean)
- [ ] Migrate to EAS-managed credentials (pending)
- [ ] Enable Play App Signing if not already on (pending)

---

**Last Updated**: 2026-04-19
**Policy Owner**: Security Team
**Review Schedule**: Quarterly or after any security incident
