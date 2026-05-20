module.exports = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    return res.redirect('/');
  }
  next();
};