# TrailQuest browser demo checklist

Open `http://localhost:5173` with the backend running at `http://localhost:8000`.

## Account and sign-in

- [ ] Select **Create account**, enter the account details, and request an OTP.
- [ ] Enter an incorrect OTP and confirm it is rejected.
- [ ] Enter the valid OTP (in development mode, use the code shown in the app or backend console) to finish creating the account.
- [ ] Open **Me** → **Settings** → **Log out**.
- [ ] Try to sign in with the correct account and a wrong password; confirm sign-in is rejected.
- [ ] Sign in with the correct password.

## Quest

- [ ] Open **Quest**, set **Minutes** to `10` and **Where** to `outdoor`, then select **Generate quest**.
- [ ] Check the quest badge for **Gemma** (or note if the backup rules-engine badge appears).
- [ ] Select **Start quest**, wait 35 seconds, then select **I'm back**.
- [ ] Enter `3200` in **Steps (from your watch or phone)** and select **Complete quest**.

## App sections and preferences

- [ ] Select **Home**.
- [ ] Select the steps card under **Today's progress** to open **Today**; use the back arrow to return.
- [ ] Open **Me** → **Open trail journal** to visit **Journal**.
- [ ] Select **Map**.
- [ ] Select **Snaps**.
- [ ] Select **Me**, then the gear icon to open **Settings**.
- [ ] In **Settings**, select **Dark** mode, the **Ocean** theme, and **Miles** under **Units**.
