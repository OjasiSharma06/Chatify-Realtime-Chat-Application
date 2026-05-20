// middleware/auth.js
module.exports = (req, res, next) => {
  // If there is no userId in the session, they are not logged in!
  if (!req.session.userId) {
    // If it's an API request, send JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    // If they are trying to load a page, redirect to login
    return res.redirect('/');
  }
  next(); // They are logged in, proceed to the route!
};