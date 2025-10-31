# Testing Open Graph Metadata Locally

## 📋 Overview
This guide shows you how to test the Open Graph (OG) metadata that appears when sharing your site on social media platforms.

## 🛠️ Methods to Test

### Method 1: Browser Extensions (Easiest)

#### **OpenGraph Preview (Chrome/Edge)**
1. Install [OpenGraph Preview](https://chrome.google.com/webstore/detail/opengraph-preview/ehaigphokkgebnmdiicabhjhddkaekgh)
2. Navigate to `http://localhost:3000`
3. Click the extension icon
4. See a live preview of how your link will appear

#### **Social Share Preview (Firefox)**
1. Install [Social Share Preview](https://addons.mozilla.org/en-US/firefox/addon/social-share-preview/)
2. Navigate to `http://localhost:3000`
3. Click the extension icon
4. View Facebook, Twitter, and LinkedIn previews

### Method 2: View Page Source

1. Start your dev server:
   ```bash
   npm run dev
   # or
   bun dev
   ```

2. Navigate to `http://localhost:3000`

3. Right-click → "View Page Source" (or `Cmd+Option+U` on Mac, `Ctrl+U` on Windows)

4. Search for these meta tags:
   ```html
   <meta property="og:title" content="Hint AI - E-commerce Analytics & Optimization Assistant">
   <meta property="og:description" content="Unlock powerful insights...">
   <meta property="og:image" content="https://ai.hint.work/og-image.png">
   <meta name="twitter:card" content="summary_large_image">
   ```

### Method 3: Social Media Debug Tools (Most Accurate)

These show EXACTLY how your site will appear when shared:

#### **Facebook Sharing Debugger**
🌐 https://developers.facebook.com/tools/debug/

**How to use with localhost:**
1. Use a tunneling service (see Method 4 below)
2. Or deploy to a staging environment
3. Paste the URL into the debugger
4. Click "Scrape Again" to refresh cache

#### **LinkedIn Post Inspector**
🌐 https://www.linkedin.com/post-inspector/

1. Same as Facebook - needs a public URL
2. Paste your URL
3. View the preview

#### **Twitter Card Validator**
🌐 https://cards-dev.twitter.com/validator

1. Needs public URL
2. Enter URL and preview

### Method 4: Using ngrok for Local Testing with Social Debuggers

To test with real social media debuggers using your local development server:

1. **Install ngrok:**
   ```bash
   brew install ngrok
   # or download from https://ngrok.com/download
   ```

2. **Start your dev server:**
   ```bash
   bun dev  # runs on port 3000
   ```

3. **In a new terminal, start ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (looks like `https://abc123.ngrok.io`)

5. **Set the environment variable** (optional):
   ```bash
   # In your .env.local
   NEXT_PUBLIC_SITE_URL=https://abc123.ngrok.io
   ```

6. **Test with the social debuggers:**
   - Use the ngrok URL in Facebook Sharing Debugger
   - Use it in LinkedIn Post Inspector
   - Use it in Twitter Card Validator

### Method 5: Command Line (curl)

```bash
# View all meta tags
curl -s http://localhost:3000 | grep -E 'og:|twitter:'

# Pretty print with xmllint (if installed)
curl -s http://localhost:3000 | xmllint --html --xpath "//meta[starts-with(@property, 'og:') or starts-with(@name, 'twitter:')]" - 2>/dev/null
```

## 📝 Checklist

When testing, verify:

- ✅ **Image displays correctly** (1200x630px)
- ✅ **Title is compelling** and under 60 characters
- ✅ **Description is clear** and under 155 characters
- ✅ **URL is correct** (https://ai.hint.work)
- ✅ **Locale is set** (currently "fr")
- ✅ **Twitter card type** is "summary_large_image"
- ✅ **Image loads** from `/og-image.png`

## 🖼️ Image Requirements

Your OG image should:
- **Size:** 1200 x 630 pixels (1.91:1 ratio)
- **Format:** PNG, JPG, or WebP
- **Max file size:** 8 MB (but aim for < 300 KB)
- **Location:** `/public/og-image.png`

## 🚀 Testing in Production

Once deployed:

1. Test the live URL in all social debuggers
2. Share a test post on your personal accounts
3. Clear cache in debuggers if you update the image
4. Verify on multiple devices

## 🐛 Common Issues

### Image not showing?
- Check `/public/og-image.png` exists
- Verify file permissions
- Clear social media cache (use debuggers)
- Ensure URL is publicly accessible

### Wrong content showing?
- Social platforms cache aggressively
- Use "Scrape Again" buttons in debuggers
- Can take 24-48 hours to update on some platforms

### localhost not working with debuggers?
- Social media can't access localhost
- Use ngrok or similar tunneling service
- Or test on a staging/production environment

## 📚 Resources

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters)
