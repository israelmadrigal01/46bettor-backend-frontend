const express = require('express'); const router = express.Router();
router.get('/', (req,res)=>res.json({ok:true, route:'picks'}));
module.exports = router;
