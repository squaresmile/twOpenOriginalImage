( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


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
}  // end of get_bool()


function get_int( value ) {
    if ( isNaN( value ) ) {
        return null;
    }
    return parseInt( value, 10 );
} // end of get_int()


function get_text( value ) {
    if ( value === undefined ) {
        return null;
    }
    return String( value );
} // end of get_text()


function get_init_function( message_type, option_name_to_function_map, namespace ) {
    var option_names = [];
    
    Object.keys( option_name_to_function_map ).forEach( function ( option_name ) {
        option_names.push( option_name );
    } );
    
    function analyze_response( response ) {
        var options = {};
        
        if ( ! response ) {
            response = {};
        }
        
        Object.keys( option_name_to_function_map ).forEach( function ( option_name ) {
            if ( ! ( response.hasOwnProperty( option_name ) ) ) {
                options[ option_name ] = null;
                return;
            }
            options[ option_name ] =  option_name_to_function_map[ option_name ]( response[ option_name ] );
        } );
        return options;
    }
    
    function init( callback ) {
        // https://developer.chrome.com/extensions/runtime#method-sendMessage
        chrome.runtime.sendMessage( {
            type : message_type
        ,   names : option_names
        ,   namespace :  ( namespace ) ? namespace : ''
        }, function ( response ) {
            var options = analyze_response( response );
            callback( options );
        } );
    }
    
    return init;
} // end of get_init_function()


var twOpenOriginalImage_chrome_init = ( function() {
    var option_name_to_function_map = {
            SHOW_IN_DETAIL_PAGE : get_bool
        ,   SHOW_IN_TIMELINE : get_bool
        ,   ENABLED_ON_TWEETDECK : get_bool
        ,   DISPLAY_ALL_IN_ONE_PAGE : get_bool
        ,   DISPLAY_OVERLAY : get_bool
        ,   OVERRIDE_CLICK_EVENT : get_bool
        ,   DISPLAY_ORIGINAL_BUTTONS : get_bool
        ,   OVERRIDE_GALLERY_FOR_TWEETDECK : get_bool
        ,   DOWNLOAD_HELPER_SCRIPT_IS_VALID : get_bool
        ,   SWAP_IMAGE_URL : get_bool
        ,   HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY : get_bool
        ,   SUPPRESS_FILENAME_SUFFIX : get_bool
        ,   OPERATION : get_bool
        ,   WAIT_AFTER_OPENPAGE : get_int
        ,   TITLE_PREFIX : get_text
        ,   TWEET_LINK_TEXT : get_text
        ,   BUTTON_TEXT : get_text
        ,   BUTTON_HELP_DISPLAY_ALL_IN_ONE_PAGE : get_text
        ,   BUTTON_HELP_DISPLAY_ONE_PER_PAGE : get_text
        ,   DOWNLOAD_HELPER_BUTTON_TEXT : get_text
        };
    
    return get_init_function( 'GET_OPTIONS', option_name_to_function_map );
} )(); // end of twOpenOriginalImage_chrome_init()

w.twOpenOriginalImage_chrome_init = twOpenOriginalImage_chrome_init;


chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
    switch ( message.type )  {
        case 'DOWNLOAD_IMAGE_REQUEST' :
            if ( ( ! message.img_url_orig ) || ( ! message.filename ) ) {
                sendResponse( {
                    result : 'NG',
                    message : 'parameter error'
                } );
                return false;
            }
            
            fetch( message.img_url_orig )
            .then( ( response ) => response.blob() )
            .then( ( blob ) => {
                if ( typeof saveAs == 'function' ) {
                    saveAs( blob, message.filename );
                }
                else {
                    var link = d.createElement('a');
                    
                    link.href = URL.createObjectURL( blob );
                    link.download = message.filename;
                    d.documentElement.appendChild( link );
                    link.click(); // TweetDeck だと、ダウンロードできない（ダウンロードが無効化されるイベントが設定されてしまう）=> saveAs() が有効ならばそちらを使用
                    d.documentElement.removeChild( link );
                }
                sendResponse( {
                    result : 'OK'
                } );
            } ) ;
            break;
        
        default :
            sendResponse( {
                result : 'NG',
                message : 'unknown type'
            } );
            return false;
    }
    return true;
} );

} )( window, document );

// ■ end of file
