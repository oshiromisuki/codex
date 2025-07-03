# Subscription Manager

This is a simple web application to track subscription services. It uses a small Node.js server without external dependencies.

## Features
- User sign up and login (username + password)
- Manage subscriptions with name, amount, currency, payment date and renewal date
- Record monthly usage of each subscription
- Notify when a subscription has not been used for 3 months (up to 3 suggestions are shown)

Currency conversion is left as a placeholder. The server stores an exchange rate in `data.json` and exposes `/api/exchangeRate`.

## Running

```
node src/server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

Data is persisted in `data.json` in the repository root.
