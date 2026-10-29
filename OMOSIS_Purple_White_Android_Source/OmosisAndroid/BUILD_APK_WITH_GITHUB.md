# Build Omosis APK using GitHub Actions (no local Android Studio required)

This repository includes `.github/workflows/android-apk.yml`. GitHub will install dependencies, generate the Android project, compile an APK, and attach the APK as a downloadable workflow artifact.

## Steps

1. Sign in to https://github.com/ or create a free account.
2. Create a **new private repository** named `OmosisAndroid`. Do not initialize it with a README, license, or `.gitignore`.
3. On the new repository page, choose **Add file → Upload files**.
4. Extract `OmosisAndroid_Source.zip` on your computer. Open the extracted `OmosisAndroid` folder.
5. Upload the **contents** of that folder (not the outer folder itself) into the GitHub repository. Make sure the hidden `.github` folder and its `workflows/android-apk.yml` file are included. If Windows hides dot-folders, enable **View → Show → Hidden items** in File Explorer.
6. Commit the upload to the `main` branch.
7. In the repository, open the **Actions** tab. Select **Build Omosis Android APK** from the workflows list. If asked, enable GitHub Actions.
8. Open the latest run and wait until it completes successfully (green check mark).
9. At the bottom of that run page, find **Artifacts** and download `Omosis-Android-APK`. It downloads as a ZIP; extract it to get `app-release.apk`.
10. Transfer `app-release.apk` to your Android phone, tap it, and allow installation from that source if Android asks.

## Notes

- This is a testing APK signed with the default debug signing configuration; it is suitable for installing/testing, not for Play Store release.
- The first build may take several minutes and requires GitHub's hosted runner to access npm and Gradle repositories.
- Do not add Supabase service-role keys or database passwords to GitHub. Only the client-safe publishable/anon key belongs in the app.
- A successful APK build does not prove live Supabase policies or order submission are correct. Test authentication, catalog, COD checkout, and order history before using real customer data.
- If the workflow fails, open the failed step, copy the last 30–50 lines of its log, and review the error before retrying.
