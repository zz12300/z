// 解锁迅雷会员 + 模拟 vipList + 美化昵称
try {
  let obj = JSON.parse($response.body);

  // 顶层字段
  obj.vip = 1;
  obj.nickname = "超级会员";
  obj.expire = "2099-12-31";

  // vipList 结构
  obj.vipList = [{
    "expireDate": "20991231",
    "isAutoDeduct": "0",
    "isVip": "1",
    "isYear": "1",
    "payId": "0",
    "payName": "Mocked",
    "register": "0",
    "vasid": "2",
    "vasType": "5",
    "vipDayGrow": "20",
    "vipGrow": "9999",
    "vipLevel": "10"
  }];

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  console.log("迅雷解锁异常:", e);
  $done({});
}