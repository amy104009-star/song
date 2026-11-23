# 璃璃歌單

公開歌單支援搜尋、歌手篩選與不重複隨機抽歌。歌曲保存在 `client/src/data/songs.json`。

## 管理歌單

1. 用 `amy104009-star` 帳號開啟 [GitHub 權杖設定](https://github.com/settings/personal-access-tokens/new)，建立 Fine-grained personal access token。
2. 在 Repository access 選 Only select repositories，勾選 `song`。在 Repository permissions 將 Contents 設為 Read and write。
3. 開啟網站的「管理歌單」，貼上權杖並連線。權杖只在這次開啟的頁面中使用，登出或重新整理後需重新輸入。
4. 新增或編輯時，先把資料加入草稿。移除歌曲也會先更新草稿。按「儲存到 GitHub」將修改提交到 `main`。部署完成後，訪客即可看到變更。

## 建置與部署

使用 Node.js 22 與專案指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
```

第一次部署時，在 [Settings → Pages](https://github.com/amy104009-star/song/settings/pages) 將 Source 設為 GitHub Actions，然後在 [Actions](https://github.com/amy104009-star/song/actions) 執行 Deploy playlist to GitHub Pages。後續提交到 `main` 時會自動部署。

預計網址為 [公開歌單](https://amy104009-star.github.io/song/) 與 [管理歌單](https://amy104009-star.github.io/song/?admin)。
