const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

// Load root .env.local, then root .env as fallback
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
// dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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

// Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    });
}

module.exports = app;
