module.exports = (req, res) => {
  res.json({
    body: req.body,
    query: "qainner",
    cookies: req.cookies,
  })
}
