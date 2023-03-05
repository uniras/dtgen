const e = require('express');

/*
JavaScriptオブジェクトから簡易Dart型情報を作成する

特徴:

関数・オブジェクトを除くプロパティの型はすべてdynamic
関数の戻り値、引数の型はすべてdynamic
引数は最大10個まで(paramlenで変更可能)。
オブジェクトは変数名を大文字にしたクラスを生成
Dartの仕様により、先頭に_が付いている変数は出力しません
*/
const main = function (param) {
    /*
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
    */
    let fs = require('fs');
    let outputdir = typeof param.output === 'string' ? __dirname + '/' + param.output : __dirname + '/';

    if(!fs.existsSync(outputdir)) {
        fs.mkdirSync(outputdir);
    }

    for(module of param.modules) {
        if(typeof module.modname !== 'string') continue;
        let result = dtgen(module.modname, module.initcode, module.classname, module.annotation, module.excepts, module.paramlen);
        fs.writeFileSync(outputdir + '/' + module.modname + '.dart', result);
    }
}

const dtgen = function (modname, initcode = '', name = '', annotation = '', excepts = [], paramlen = 10) {
    if (typeof modname === 'object' || typeof modname === 'function') return generate(modname, name, annotation, excepts, paramlen);
    if (typeof modname !== 'string' || modname.length === 0) return '';
    if (typeof name !== 'string' || name.length === 0) name = modname;

    let module = require(modname);

    if (typeof initcode === 'string' && initcode.length > 0) {
        module = eval(initcode);
    }

    return generate(module, name, annotation, excepts, paramlen);
}

const generate = function (object, name, annotation, excepts, paramlen) {
    var result = '';
    let stack = new Array();
    let datas = new Object();
    let indent = '  ';
    let os = require('os');

    if (Array.isArray(excepts)) excepts = [];
    if (typeof paramlen !== 'number' || paramlen < 0) paramlen = 10;

    //オブジェクトの判別
    if (typeof object === 'object' && !Array.isArray(object)) {
        if (typeof object.constructor.prototype !== 'undefined' && object.constructor.toString().startsWith('class')) {
            //インスタンス
            stack.unshift({ obj: object.constructor, pin: 0, name: name, annotation: annotation, isclass: true });
        } else {
            //通常のJavaScriptオブジェクト
            if (Object.keys(object).length <= 0) return '';
            stack.unshift({ obj: object, pin: 0, name: name, annotation: annotation, isclass: false });
        }
    } else if(typeof object === 'function') {
        //クラスまたは関数
        stack.unshift({ obj: object, pin: 0, name: name, annotation: annotation, isclass: object.toString().startsWith('class')});
    } else {
        //クラス・関数・インスタンス・オブジェクトのいずれでもない場合は空文字を返して終了
        return '';
    }

    while (true) {
        //ベースとなるオブジェクト自体がundefinedの場合はスタックをpop
        if (typeof stack[0].obj === 'undefined' || stack[0].obj === null) {
            stack.shift();
            if (stack.length === 0) break;
        }

        let stackname = stack[0].name;
        let stackpin = stack[0].pin;

        //型定義の最初の部分を出力
        if (stackpin === 0) {
            datas[stackname] = '@JS(';
            datas[stackname] += typeof stack[0].annotation !== 'string' || stack[0].annotation.length === 0 ? '' : '\'' + stack[0].annotation + '\'';
            datas[stackname] += ')' + os.EOL;
            datas[stackname] += 'class ' + stackname + os.EOL;
            datas[stackname] += '{' + os.EOL;
            stack[0].objcount = 0;
        }

        //プロパティ一覧を取得
        if (typeof stack[0].objkeys === 'undefined') {
            if (stack[0].isclass) {
                //クラスの場合
                let statickeys = Object.getOwnPropertyNames(stack[0].obj);
                let instancekeys = Object.getOwnPropertyNames(stack[0].obj.prototype);
                stack[0].staticlen = statickeys.length;
                stack[0].objkeys = statickeys.concat(instancekeys);
            } else {
                //オブジェクトの場合
                stack[0].staticlen = 0;
                stack[0].objkeys = Object.keys(stack[0].obj);
            }
        }

        //プロパティ名とそのオブジェクトを取得
        let pinname = stack[0].objkeys[stackpin];
        var pinobj;
        try {
            if (!stack[0].isclass || stack[0].staticlen <= stackpin) {
                pinobj = stack[0].obj[pinname];
            } else {
                pinobj = stack[0].obj.prototype[pinname];
            }
        } catch (e) {
        }

        stack[0].pin += 1;

        //すべてのプロパティを列挙したら最後の部分を出力してpop
        if (stackpin >= stack[0].objkeys.length) {
            if(stack[0].objcount <= 0) {
                delete datas[stackname];
            } else {
                datas[stackname] += '}' + os.EOL;
            }
            stack.shift();
            if (stack.length === 0) break;
            continue;
        }

        //Dartクラスのメンバにできなさそうなプロパティは出力しない
        //if (typeof pinobj === 'undefined') continue;
        if (typeof pinname === 'undefined') continue;
        if (typeof pinname === 'string' && pinname.indexOf('_') === 0) continue;
        if (typeof pinname === 'string' && pinname.indexOf('-') !== -1) continue;
        if (typeof pinname === 'string' && pinname.indexOf(' ') !== -1) continue;
        if (excepts.includes(pinname)) continue;

        stack[0].objcount += 1;

        let staticstr = stack[0].staticlen <= stackpin ? '' : 'static ';

        if (typeof pinobj === 'object' && !Array.isArray(pinobj)) {
            //プロパティの型がオブジェクト(配列ではない)
            if (typeof pinobj.constructor !== 'undefined' && typeof pinobj.constructor.prototype !== 'undefined' && pinobj.constructor.toString().startsWith('class')) {
                //オブジェクトがインスタンス
                let classname = pinobj.constructor.name;
                let thisobj = pinobj.constructor;
                var newclass = name + '_' + classname.toUpperCase();
                datas[stackname] += indent + 'external ' + staticstr + newclass + ' ' + pinname + ';' + os.EOL;
                while (true) {
                    newclass = name + '_' + classname.toUpperCase();
                    if (!datas.hasOwnProperty(newclass)) {
                        stack.unshift({ obj: thisobj, pin: 0, name: newclass, annotation: '', isclass: true });
                    }
                    thisobj = Object.getPrototypeOf(thisobj);
                    classname = thisobj.name;
                    if (!thisobj.toString().startsWith('class')) break;
                }
            } else {
                //通常のJavaScriptオブジェクト
                if (Object.keys(pinobj).length > 0) {
                    let newclass = name + '_' + pinname.toUpperCase();
                    datas[stackname] += indent + 'external ' + staticstr + newclass + ' ' + pinname + ';' + os.EOL;
                    if (!datas.hasOwnProperty(newclass)) {
                        stack.unshift({ obj: pinobj, pin: 0, name: newclass, annotation: '', isclass: false });
                    }
                } else {
                    datas[stackname] += indent + 'external ' + staticstr + 'dynamic ' + pinname + ';' + os.EOL;
                }
            }
        } else if (typeof pinobj === 'object' && Array.isArray(pinobj)) {
            //プロパティの型が配列
            datas[stackname] += indent + 'external ' + staticstr + 'List<dynamic> ' + pinname + ';' + os.EOL;
        } else if (typeof pinobj === 'function') {
            if (pinobj.toString().startsWith('class')) {
                //プロパティの型がクラス
                let classname = pinobj.name;
                let thisobj = pinobj;
                var newclass = name + '_' + classname.toUpperCase();
                datas[stackname] += indent + 'external ' + staticstr + newclass + ' ' + pinname + ';' + os.EOL;
                while (true) {
                    newclass = name + '_' + classname.toUpperCase();
                    if (!datas.hasOwnProperty(newclass)) {
                        stack.unshift({ obj: thisobj, pin: 0, name: newclass, annotation: '', isclass: true });
                    }
                    thisobj = Object.getPrototypeOf(thisobj);
                    classname = thisobj.name;
                    if (!thisobj.toString().startsWith('class')) break;
                }
            } else {
                //プロパティの型が関数
                datas[stackname] += indent + 'external ' + staticstr + 'dynamic ' + pinname + '([';
                for (let i = 0; i < paramlen; i++) {
                    if (i > 0) datas[stackname] += ', ';
                    datas[stackname] += 'p' + i;
                }
                datas[stackname] += ']);' + os.EOL;
            }
        } else {
            //それ以外の場合はフィールドとして扱う
            datas[stackname] += indent + 'external ' + staticstr + 'dynamic ' + pinname + ';' + os.EOL;
        }
    }

    result = `import \'package:js/js.dart\';` + os.EOL + os.EOL;
    for (let key in datas) {
        result += datas[key] + os.EOL;
    }

    return result;
}

exports.dtgen = dtgen;

if (require.main === module) {
    // このモジュールを node で直接起動した場合のみ実行される
    const fs = require('fs');
    let configfile = __dirname + '/dtgen.json';
    if (fs.existsSync(configfile)) {
        let param = JSON.parse(fs.readFileSync(configfile));
        main(param);
        return 0;
    } else {
        console.log(configfile + 'がありません');
        return -1;
    }
}