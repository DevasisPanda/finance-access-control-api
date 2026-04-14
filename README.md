
# Miravi Mart

Miravi Mart is a lightweight, full-stack e-commerce mini application. It features a Node.js/Express backend, an in-memory product store, and a responsive vanilla JavaScript frontend for managing products. This project was created as part of the Miravi Full Stack Developer Assessment.

## Features

- 🛒 View all products on the homepage
- ➕ Add products with name, price, and image URL
- ✏️ Edit existing products
- 🗑️ Delete products instantly from the UI
- ✅ Client-side & server-side validation
- ⏳ Loading and empty states
- 📱 Mobile-friendly, responsive layout

## Tech Stack

- Node.js
- Express.js
- HTML, CSS, and vanilla JavaScript

## Product API

RESTful endpoints:

- `GET /products` — Retrieve all products
- `POST /products` — Create a new product
- `PUT /products/:id` — Update an existing product
- `DELETE /products/:id` — Delete a product

**Product object shape:**

```json
{
  "id": "string",
  "name": "Nordic Desk Lamp",
  "price": 49.99,
  "imageUrl": "https://example.com/image.jpg"
}
```

## Getting Started Locally

1. **Install dependencies:**
  ```bash
  npm install
  ```
2. **Start the development server:**
  ```bash
  npm start
  ```
3. **Open the app in your browser:**
  [http://localhost:3000](http://localhost:3000)

**Optional:**
Set a custom port by creating a `.env` file or setting the environment variable:
```env
PORT=3000
```

## Deployment (Vercel)

This project is ready for instant deployment on [Vercel](https://vercel.com/) — no database or environment variables required.

1. Push your repository to GitHub.
2. Import the repo into Vercel, or deploy from the CLI:
  ```bash
  npm i -g vercel
  vercel
  ```
3. For local Vercel-style testing:
  ```bash
  vercel dev
  ```

**Deployment notes:**
- Static files are in the `public/` directory
- The root page is `index.html`
- Product data is in-memory and resets on redeploys or cold starts

## Testing

Automated tests cover:
- Homepage rendering
- Seeded product listing
- Product creation and validation
- Product updates and missing IDs
- Product deletion and list refresh

To run tests:
```bash
npm test
```

## Notes

- Product data is stored in memory and resets when the server restarts.
- The app ships with three demo products so the homepage is populated immediately.

---

## Author

Created by [Your Name].

Feel free to reach out for questions or suggestions!
