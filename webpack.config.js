const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin'); //Extract CSS
const UglifyJsPlugin = require('uglifyjs-webpack-plugin'); // Minify JS
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

module.exports = {
   mode: "production", // "production" | "development" | "none"
   entry: ['./src/import-module.js'],
   output: {
       path: path.resolve(__dirname, 'dist'),
       publicPath:'./dist/',
       filename: 'js/app.js',
   },
   module: {
       rules: [{
           test:/\.(s*)css$/, 
           use: ExtractTextPlugin.extract({  //Seperate files [css]
               fallback:'style-loader',
               use:['css-loader','sass-loader'],
               publicPath: '../' //custom path for css public path
           })
       }, {
       test: /\.(png|jpg|gif)$/,
       use: [
         {
           loader: 'file-loader',
           options: {
               outputPath: 'img/'//custom path for images
           }
         }
       ]
     },
     {
        // Exposes jQuery for use outside Webpack build
        test: require.resolve('jquery'),
        use: [{
            loader: 'expose-loader',
            options: 'jQuery'
        }, {
            loader: 'expose-loader',
            options: '$'
        }]
    },
{ 
       test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
       use: [
           {
               loader: "url-loader?limit=10000&mimetype=application/font-woff",
               options: {
                   outputPath: 'fonts/'
               } 
           }
       ] 
       
    },
    { 
       test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
       use: [
           {
               loader: "file-loader",
               options: {
                   outputPath: 'fonts/'
               }
           }
       ] 
        
   }
     ]
   },
   plugins: [
       new ExtractTextPlugin({filename:'css/main.css'}),
       new CaseSensitivePathsPlugin(),
       new webpack.ProvidePlugin({
           $: "jquery",  
           jQuery: "jquery" 
       })
   ],
   optimization: {
       minimizer: [
         new UglifyJsPlugin({ //minify JS
           test: /\.js($|\?)/i
       })]
   }
};
