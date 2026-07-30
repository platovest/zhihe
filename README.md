# 知合 ZHIHE

本地运行的中文亲密健康教育 MVP，不依赖 OpenAI Sites 或线上登录。

## 本地启动

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

购买意向会写入项目本地的 Cloudflare D1 开发数据库，不会上传到线上。

## 验证

```bash
npm test
npm run lint
```
