# JavaScriptオブジェクト to Dartタイプジェネレータ

JavaScriptオブジェクトから簡易的なDart用型情報ファイルを生成します。

`.d.ts`のような厳密な型情報ではなく、ひとまずさくっとDartからJavaScriptライブラリが使えるようにする方向性です。


## 特徴

- 関数・オブジェクトを除くプロパティの型はすべてdynamic
- 関数の戻り値、引数の型はすべてdynamic
- 引数は最大10個まで(paramlenで変更可能)。
- オブジェクトは変数名を大文字にしたクラスを生成
- Dartの仕様により、先頭に_が付いている変数は出力しません


## インストール

Node.jsをインストールして、dtgen.jsをコピーするだけです。

標準モジュールだけで作成しているのでnpm等でモジュールをインストールする必要はありません。


## 使い方

### 直接実行

dtgen.jsと同じディレクトリにdtgen.jsonを作成し、nodeコマンドでdtgen.jsを実行します。

### モジュール

commonjsモジュールとして取り込み、dtgen関数を呼び出します。

## dtgen.jsonの仕様

```javascript
{
    "output" : "", //出力先のパス(dtgen.jsからの相対パス)
    "modules" : [  //モジュール
        {
            "modname" : "",    //モジュール名
            "initcode" : "",   //モジュール初期化用JavaScriptコード(省略すると空文字列)
            "classname" : "",  //クラス名・ファイル名(省略するとモジュール名と同じ)
            "annotation" : "", //型定義のJSアノテーションに指定する文字列(省略すると空文字列)
            "excepts" : ["", "", ...],  //型定義に出力しない変数・関数名の一覧
            "paramlen" : 10,   //関数パラメータの数(省略すると10)
        },
        {
        },...
    ]
}
```