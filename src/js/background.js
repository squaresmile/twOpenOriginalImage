( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var DEBUG = false,
    
    CONTEXT_MENU_INITIALIZED = false,
    CONTEXT_MENU_IS_VISIBLE = true,
    CONTEXT_MENU_IS_SUSPENDED = false,
    
    DOWNLOAD_MENU_ID = 'download_image';


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    console.log.apply( console, arguments );
} // end of log_debug()


var is_firefox = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'firefox' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_firefox()


var is_edge = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'edge' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_edge()


function get_bool( value ) {
    if ( value === undefined ) {
        return null;
    }
    if ( ( value === '0' ) || ( value === 0 ) || ( value === false ) || ( value === 'false' ) ) {
        return false;
    }
    if ( ( value === '1' ) || ( value === 1 ) || ( value === true ) || ( value === 'true' ) ) {
        return true;
    }
    return null;
} // end of get_bool()


function update_context_menu_flags() {
    var is_valid = ( get_bool( localStorage[ 'DOWNLOAD_HELPER_SCRIPT_IS_VALID' ] ) !== false ) ? true : false,
        operation = ( get_bool( localStorage[ 'OPERATION' ] ) !== false ) ? true : false;
    
    CONTEXT_MENU_IS_VISIBLE = is_valid;
    CONTEXT_MENU_IS_SUSPENDED = ! operation;
    
    log_debug( 'CONTEXT_MENU_IS_VISIBLE:', CONTEXT_MENU_IS_VISIBLE, 'CONTEXT_MENU_IS_SUSPENDED:', CONTEXT_MENU_IS_SUSPENDED );
} // end of update_context_menu_flags()


function get_url_info( url ) {
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : parts[ 1 ];
    } );
    
    return url_info;
} // end of get_url_info()


function normalize_img_url( source_url ) {
    var url_info = get_url_info( source_url ),
        base_url = url_info.base_url,
        format = url_info.query_map.format,
        name = url_info.query_map.name;
    
    if ( ! format ) {
        return source_url;
    }
    
    return base_url + '.' + format + ( ( name ) ? ':' + name : '' );
} // end of normalize_img_url()


function get_filename_from_image_url( img_url ) {
    if ( ! /:\w*$/.test( img_url ) ) {
        return null;
    }
    return img_url.replace( /^.+\/([^\/.]+)\.(\w+):(\w+)$/, '$1-$3.$2' );
} // end of get_filename_from_image_url()


function download_image( img_url ) {
    img_url = normalize_img_url( img_url );
    
    var img_url_orig = img_url.replace( /:\w*$/, '' ) + ':orig',
        filename = get_filename_from_image_url( img_url_orig );
    
    log_debug( '*** download_image():', img_url, img_url_orig, filename );
    
    // ある時点から、ファイル名が変わらなくなった(0.1.7.1000で2017年7月末頃発生・クロスドメインとみなされている模様)
    //var download_link = d.createElement( 'a' );
    //download_link.href = img_url_orig;
    //download_link.download = filename;
    //d.documentElement.appendChild( download_link );
    //download_link.click();
    
    // 覚書：「Download with Free Download Manager (FDM)」等を使っていると、ここで指定したファイル名が無視される
    // → DeterminingFilename イベントを監視し、そこでファイル名を指定するように修正(0.1.7.1701)
    // → イベント監視だと、他の拡張機能との競合が発生するため、別の方法を検討(0.1.7.1702)
    //chrome.downloads.download( {
    //    url : img_url_orig
    //,   filename : filename
    //} );
    
    if ( is_firefox() && /\.png$/i.test( filename ) ) {
        // TODO: Firefox WebExtension の場合、XMLHttpRequest / fetch() の結果得た Blob を Blob URL に変換した際、PNG がうまくダウンロードできない
        // → 暫定的に PNG のみ、chrome.downloads.download() を使う
        chrome.downloads.download( {
            url : img_url_orig
        ,   filename : filename
        } );
        return;
    }
    
    var xhr = new XMLHttpRequest();
    
    xhr.open( 'GET', img_url_orig, true );
    xhr.responseType = 'blob';
    xhr.onload = function () {
        if ( xhr.readyState != 4 ) {
            return;
        }
        
        var blob = xhr.response,
            download_link = d.createElement( 'a' );
        
        download_link.href = URL.createObjectURL( blob );
        download_link.download = filename;
        
        d.documentElement.appendChild( download_link );
        
        download_link.click();
        // TODO: MS-Edge 拡張機能の場合、ダウンロードされない
        // TODO: Firefox WebExtension の場合、XMLHttpRequest / fetch() の結果得た Blob を Blob URL に変換した際、PNG がうまくダウンロードできない
        
        download_link.parentNode.removeChild( download_link );
    };
    xhr.onerror = function () {
        chrome.downloads.download( {
            url : img_url_orig
        ,   filename : filename
        } );
    };
    xhr.send();

} // end of download_image()


function on_determining_filename( downloadItem, suggest ) {
    update_context_menu_flags();
    
    if ( ( ! CONTEXT_MENU_IS_VISIBLE ) || CONTEXT_MENU_IS_SUSPENDED ) {
        return true;
    }
    if ( downloadItem.byExtensionId != chrome.runtime.id ) {
        // 本拡張機能以外から保存した場合は無視
        // ※この判定を無効化すれば、コンテキストメニューから「名前を付けて画像を保存」した場合も、http://～/xxx.jpg:kind → xxx-kind.jpg に変換される
        return true;
    }
    
    var url = downloadItem.finalUrl || downloadItem.url;
    
    if ( ! /^https?:\/\/pbs\.twimg\.com\/media\/[^:]+:\w*$/.test( url ) ) {
        return true;
    }
    
    suggest( {
        filename : get_filename_from_image_url( url )
    } );
    return true;
} // end of on_determining_filename()


function initialize( eventname ) {
    log_debug( '*** initialize():', eventname );
    
    if ( is_edge() ) {
        // TODO: MS-Edge の拡張機能だと、background スクリプトからのダウンロードが出来ない(?)
        //   参考： [Extensions - Supported APIs - Microsoft Edge Development | Microsoft Docs](https://docs.microsoft.com/en-us/microsoft-edge/extensions/api-support/supported-apis)
        //   | ・Triggering a download via a hidden anchor tag will fail from background scripts. This should be done from an extension page instead.
        //
        // ・browser.downloads API が存在しない(2017/04/11現在のロードマップで、"Under consideration" になっている
        //   [Extensions - Extension API roadmap - Microsoft Edge Development | Microsoft Docs](https://docs.microsoft.com/en-us/microsoft-edge/extensions/api-support/extension-api-roadmap)
        //   | downloads | Used to programmatically initiate, monitor, manipulate, and search for downloads. | Under consideration
        //
        // ・XMLHttpRequest で取得した Blob を URL.createObjectURL() で変換したものを download 属性付 A タグの href にセットしてクリックしてもダウンロードされない
        //
        // ・navigator.msSaveOrOpenBlob() 等も使えない
        //   ※「SCRIPT16386: SCRIPT16386: インターフェイスがサポートされていません」のようなエラーになる
        //
        // ・tabs.create() で新たにタブを開いた場合も、background から開いたときは上記の不具合が継承される模様
        
        chrome.contextMenus.remove( DOWNLOAD_MENU_ID );
        return;
    }
    
    var title = chrome.i18n.getMessage( 'DOWNLOAD_ORIGINAL_IMAGE' );
    
    update_context_menu_flags();
    
    if ( ! CONTEXT_MENU_IS_VISIBLE ) {
        if ( CONTEXT_MENU_INITIALIZED ) {
            chrome.contextMenus.remove( DOWNLOAD_MENU_ID );
            CONTEXT_MENU_INITIALIZED = false;
        }
        
        log_debug( '*** initialize(): remove context menu' );
        return;
    }
    
    if ( CONTEXT_MENU_IS_SUSPENDED ) {
        title += '[' + chrome.i18n.getMessage( 'UNDER_SUSPENSION' ) +']';
    }
    
    if ( CONTEXT_MENU_INITIALIZED ) {
        chrome.contextMenus.update( DOWNLOAD_MENU_ID, {
            title : title
        } );
        
        log_debug( '*** initialize(): rename title to ', title );
        return;
    }
    
    CONTEXT_MENU_INITIALIZED = true;
    
    log_debug( '*** initialize(): completed' );
    
    // TODO:
    //   ときどき、ブラウザを再起動後等の状態で
    //   Unchecked runtime.lastError while running contextMenus.create: Cannot create item with duplicate id download_image
    //   が発生。
    //   ※ chrome.contextMenus.removeAll() 後であっても発生してしまう。
    try {
        chrome.contextMenus.create( {
            type : 'normal'
        ,   id : DOWNLOAD_MENU_ID
        ,   title : title
        ,   contexts : [ 'image' ]
        ,   targetUrlPatterns : [ '*://pbs.twimg.com/media/*' ]
        } );
    }
    catch( error ) {
        // TODO: try～catch にも引っかからない模様
        // 参考: [Issue 551912 - chromium - Try/Catch not working when trying to create existing menu](https://code.google.com/p/chromium/issues/detail?id=551912)
        console.error( error );
    }
    
} // end of initialize()


function on_message( message, sender, sendResponse ) {
    log_debug( '*** on_message():', message, sender );
    
    var type = message.type,
        response = null;
    
    switch ( type ) {
        case 'GET_OPTIONS':
            var names = message.names,
                namespace = message.namespace;
            
            response = {};
            
            if ( typeof name_list == 'string' ) {
                names = [ names ];
            }
            
            Array.apply( null, names ).forEach( function( name ) {
                name = String( name );
                response[ name ] = localStorage[ ( ( namespace ) ? ( String( namespace ) + '_' ) : '' ) + name ];
            } );
            break;
        
        case 'RESET_CONTEXT_MENU':
            initialize( 'onMessage' );
            break;
        
        default:
            break;
    }
    
    sendResponse( response );
}  // end of on_message()


function on_click( info, tab ) {
    log_debug( '*** on_click():', info, tab );
    
    update_context_menu_flags();
    
    if ( ( ! CONTEXT_MENU_IS_VISIBLE ) || CONTEXT_MENU_IS_SUSPENDED ) {
        return;
    }
    
    switch ( info.menuItemId ) {
        case DOWNLOAD_MENU_ID :
            download_image( info.srcUrl );
            break;
        default :
            break;
    }
} // end of on_click()


function on_startup() {
    log_debug( '*** on_startup()' );
    
    initialize( 'onStartup' );
} // end of on_startup()


function on_installed( details ) {
    log_debug( '*** on_installed():', details );
    
    initialize( 'onInstalled' );
} // end of on_installed()


// ■ 各種イベント設定
// [chrome.runtime - Google Chrome](https://developer.chrome.com/extensions/runtime)
// [chrome.contextMenus - Google Chrome](https://developer.chrome.com/extensions/contextMenus)

// メッセージ受信
chrome.runtime.onMessage.addListener( on_message );

// クリックイベント(コンテキストメニュー)
chrome.contextMenus.onClicked.addListener( on_click );

// Installed イベント
chrome.runtime.onInstalled.addListener( on_installed );

// Startup イベント
if ( chrome.runtime.onStartup ) {
    chrome.runtime.onStartup.addListener( on_startup );
}

// DeterminingFilename イベント
// TODO: 副作用（他拡張機能との競合）が大きいため、保留(0.1.7.1702)
//chrome.downloads.onDeterminingFilename.addListener( on_determining_filename );

} )( window, document );

// ■ end of file
