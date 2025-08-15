const express = require('express'); const router = express.Router();
router.get('/', (req,res)=>res.json({ok:true, route:'teams'}));
module.exports = router;
