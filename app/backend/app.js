const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

// Load root env files. Values in .env.local override .env when both exist.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });

const app = express()
const PORT = process.env.PORT || 8888;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", require("./routes/predict"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/education", require("./routes/education"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api", require("./routes/reports"));

// Server
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    });
}

module.exports = app;
