# Omosis Android

A real React Native + Expo Android app for the existing Omosis marketplace. It uses the same Supabase project and public client credential found in the supplied website ZIP. It does not wrap the website in a WebView and does not add online payments.

## Features in this source project
- Supabase email/password sign-up, sign-in and sign-out
- Supabase product catalog with seller store names; bundled starter catalog fallback if Supabase has no active products or the request fails
- Search, category chips, price sorting and product detail screen
- Persistent local cart with quantity controls
- COD checkout with delivery details
- Order creation using the existing `orders` and `order_items` table conventions
- Customer order history and status display
- Floating purple-and-white Omosis Assistant chat widget with product discovery, bag totals, COD guidance, order-history guidance, and support FAQs
- Loading, empty and network/error messages

## Chatbot scope
- The floating assistant is included in the app UI and responds using built-in, context-aware help rules and the currently loaded product catalogue/cart. It does not call a hosted LLM or provide live seller/support-agent messaging yet. Connect a secured server-side AI endpoint later if you want generative answers; do not ship secret API keys in the mobile app.

## Important integration notes
- The app uses the existing project URL and publishable key copied from `js/auth.js`. A Supabase publishable/anon key is client-safe when RLS is configured correctly. Never put a service-role key or database password in this project.
- The ZIP did not contain SQL migrations, so the live schema and RLS policies have not been independently verified. The app uses the column names actually referenced by the website code. If your deployed schema differs, update the relevant query only after inspecting Supabase.
- The current website inserts the order row and order items as two separate operations. This app initially follows that existing contract for compatibility. For production, replace this with a single Postgres RPC/transaction that validates current product prices, stock, quantities, and totals server-side. Do not consider client-side totals authoritative.
- The starter catalog is fallback content. If the database is empty or unreachable, the app clearly shows a banner. Orders for fallback items may fail if the database requires `product_id` to reference a real database product; this is expected and safer than pretending the order was placed.
- Admin functionality is intentionally excluded from the customer app.

## Run on a computer
1. Install Node.js LTS from https://nodejs.org/.
2. Install Android Studio from https://developer.android.com/studio if you want an emulator. You can also use a real Android phone with Expo Go for early UI testing.
3. Extract this project ZIP to a folder.
4. Open a terminal/Command Prompt in the `OmosisAndroid` folder.
5. Run `npm install`.
6. Run `npx expo start`.
7. For a physical phone, install Expo Go and scan the QR code while both devices are on the same network. For a local Android emulator, press `a` in the Expo terminal.

## Build an installable APK
The simplest cloud build is EAS Build:
1. Create/sign in to an Expo account at https://expo.dev/.
2. Install EAS CLI: `npm install -g eas-cli`.
3. Run `eas login`.
4. Run `eas build:configure` in this folder.
5. Choose an Android preview/internal APK build profile when prompted, or use the included `eas.json`.
6. Run `eas build -p android --profile preview` and follow the prompts. Download the APK link EAS provides and install it on your phone. Android may ask you to allow installation from that source.

## Test checklist
1. Sign up using an email address you can access; complete email confirmation if enabled in Supabase.
2. Sign out and sign back in.
3. Confirm live products appear from Supabase. If you see the starter-catalog notice, check that the `products` query succeeds and that active products exist.
4. Open a product, add it to the bag, change quantity, and remove it.
5. Sign in, complete the delivery form, and place a COD order using a real database product.
6. Check Supabase Table Editor: `orders` should have the order row and `order_items` its lines.
7. Open Orders in the app and verify the order/status appears.

## Database contract used
- `products`: `id`, `name`, `description`, `category`, `price`, `mrp`, `stock`, `image_url`, `active`, `created_at`, `seller_id`, relation to `seller_profiles(store_name)`
- `seller_profiles`: `user_id`, `store_name`
- `orders`: `order_number`, `user_id`, `customer_name`, `phone`, `address`, `city`, `state`, `pincode`, `landmark`, `note`, `payment_method`, `total`, `status`, `created_at`
- `order_items`: `order_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `line_total`
- Customer order history is filtered by the authenticated `user_id`. RLS must enforce that boundary server-side as well.

## Easiest APK build (GitHub, no local Android toolchain)
See [`BUILD_APK_WITH_GITHUB.md`](BUILD_APK_WITH_GITHUB.md). The included GitHub Actions workflow compiles an installable testing APK in the cloud and uploads it as an artifact. No Expo account is required for this workflow.
