# SoulPet Demo URL

最省事的明日展示方案：本机运行 SoulPet，再用国内内网穿透生成一个 HTTPS 网址。

## 推荐方式

使用 cpolar 或花生壳这类国内内网穿透工具，把本机 `3001` 端口映射成公网 HTTPS 地址。

SoulPet 已经支持一个端口完整访问：

```bash
npm run demo
```

启动后本机地址是：

```text
http://localhost:3001
```

内网穿透时只需要暴露：

```text
3001
```

## 展示前检查

1. 确认 `.env` 里有火山方舟相关配置。
2. 确认 BGM 文件存在：

```text
public/audio/soulpet-home.mp3
```

3. 运行：

```bash
npm run demo
```

4. 打开内网穿透工具，把 `localhost:3001` 暴露成 HTTPS 网址。
5. 把生成的网址发给体验者。

## 为什么不用 Vercel 或普通静态托管

这个项目需要服务端调用图片生成接口。只部署静态网页会导致 `/api/generate-pet` 和 `/api/remove-character-background` 不可用。

## 注意

电脑需要保持开机，终端和内网穿透工具都不能关。展示前建议提前 30 分钟生成并测试一次公网链接。
