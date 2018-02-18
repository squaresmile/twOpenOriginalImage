( function () {

'use strict';

window.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;

function get_url_info( url ) {
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : decodeURIComponent( parts[ 1 ] );
    } );
    
    return url_info;
} // end of get_url_info()

var url_info = get_url_info( window.location.href ),
    query_map = url_info.query_map;

//console.log( url_info );

if ( ( ! query_map.url ) || ( ! query_map.filename ) ) {
    return;
}

document.addEventListener( 'DOMContentLoaded', function () {
    var download_link = document.createElement( 'a' );
    
    download_link.href = query_map.url;
    download_link.download = query_map.filename;
    
    document.documentElement.appendChild( download_link );
    
    download_link.click();
    
    download_link.parentNode.removeChild( download_link );
    
    //window.close(); // エラー発生: 「スクリプトはスクリプトによって開かれたウィンドウ以外を閉じることができません。」
    
    setTimeout( function () {
        chrome.runtime.sendMessage( {
            type : 'CLOSE_TAB_REQUEST'
        }, function ( response ) {
            console.log( response );
        } );
    }, 1 ); // TODO: Chrome の場合、ディレイさせないとうまくダウンロードされない（※Firefoxだとディレイ無しでも可）
}, false );

} )();
