# 202503 - Mitra運用記録

## 概要

2025年1月下旬～3月上旬の期間でMitraを運用した際のレポートです。

## Mitraとは

Rustを使用したActivityPub実装のSNSソフトウェアです。  
ソースコード：https://codeberg.org/silverpill/mitra

下記URL先のような見た目のUIです。  
https://mitra.social/@mitra (Mitra公式アカウント)  
https://mitra.social/@silverpill (開発者のアカウント)  

昨今の主要な巨大SNSの動向があまりよろしくないと感じ、同時に個人で管理出来るSNSサーバーに興味が出てきたことがきっかけでMitraを知りました。  
今回はこちらを使用したサービスの運用結果を記載しています。

### ActivityPubとは

Wikipediaより引用：https://ja.wikipedia.org/wiki/ActivityPub

> ActivityPub（アクティビティ・パブ）は、オープンで非中央集権・分散型のSNSプロトコルのオープン標準である。

ActivityPubはMastodonやMisskeyといったSNSソフトウェアや、最近ではThreadsにも実装されているSNSプロトコルです。  
XやFacebook等の中央集権的SNSとは異なり、同一実装間だけではなく同プロトコルを使用した別の実装とも相互に通信を行うことが出来ます。  
(例)Mastodonを使用したサーバーとMisskeyを使用したサーバーはお互いにフォロー、投稿の閲覧等を行うことができる。  
また、ActivityPub等により実装されたSNSの集合体(連合)をFediverseと呼びます。

## 環境情報

- GPCのVMインスタンス(E2-micro・ディスク30GB・Debian 12)
  - 無料枠を使用しました。
  - ディストリビューションがUbuntuではなくDebianなのはDebian Packageを使用するためです(後述)
- nginx
  - リバースプロキシ用です。
- Cloudflare
  - DNSとWAFの設定(クローラーbotとTorからの接続をブロック)を行いました。

## デプロイ手順

依存関係をインストール

```bash
sudo apt update
sudo apt install -y \
    postgresql \
    postgresql-contrib \
    nginx \
    wget
```

Debian packageのインストール

```bash
sudo wget https://codeberg.org/silverpill/mitra/releases/download/v3.xx.x/mitra_3.xx.x_amd64.deb
sudo dpkg -i mitra_3.xx.x_amd64.deb
```

PostgreSQLの設定

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql -c "CREATE USER mitra WITH PASSWORD 'password';"
sudo -u postgres psql -c "CREATE DATABASE mitra OWNER mitra ENCODING 'UTF8';"
```

config.yamlを編集(instance_uri等を修正する)

```
sudo nano /etc/mitra/config.yaml
```

nginxの設定

```
sudo nano /etc/nginx/sites-available/mitra

sudo ln -s /etc/nginx/sites-available/mitra /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mitra.example.tld

sudo nginx -t
sudo systemctl restart nginx
```

サービス起動＆アカウント作成

```
systemctl start mitra
su mitra -s $SHELL -c "mitractl create-account <username> <password> admin"
```

## モニタリング結果

2025/1/31～2025/3/7の期間に日時ヘルスチェックを実施し、メモリ使用率などの計測を実施しました。  
結果は下記リンク先でグラフ化しています。  
https://mitra-health-check.kuroma.org/

フォロー/フォロワーは10弱で画像のアップロードや定期的なサーバー再起動はせずに利用していましたが、メモリリークが起こる事もなく非常に安定して稼働していました。

## サーバーの閉鎖

モニタリング終了後に今回使用したサーバーを閉鎖しました。  
ActivityPubを使用するソフトウェアは閉鎖する際に連合先(通信している他サーバー)に410 Goneを返す必要があります。今回は以下の記事を参考にして対応しました。

Fediverseサーバーを閉じる時（低コストで410 Goneを返し続ける方法）  
https://note.com/thetalemon/n/nacbe6ee28888

## 総括

GCPの無料枠でも安定して稼働する手軽さと、自分自身のSNSサーバーを持つことが出来る面白さを体験できました。  
ソフトウェアの使用感も良く、UIが好みでリアクション用の絵文字のカスタマイズも可能だったので非常に良い経験になりました。  
今回のモニタリングによりMitraはRaspberry Piでも動作するスペックであることが分かったので、将来的に自宅用サーバーを手に入れる機会があれば再度利用してみたいと考えています。
