{{-- 
    HTML,JSを7行(改行なし)でテトリス実装
    参考記事はこちらを参照
    https://qiita.com/ryuichi1208/items/f9e6ac2b99bbe4fc82d3
    TODO: レンダリングが走って参照内容をページ上に表示できないので、いい感じに追加したい
--}}

<body id=D onKeyDown=K=event.keyCode-38>
    <script>
        Z=X=[B=A=12];
        function Y() {
            for(C=[q=c=i=4];f=i--*K;c-=!Z[h+(K+6?p+K:C[i]=p*A-(p/9|0)*145)])
                p=B[i];
            for(c?0:K+6?h+=K:t?B=C:0;k=i=K=q--;f+=Z[A+p])
                X[p=h+B[q]]=t+1;
            if(e=!e)
                if(h+=A,f|B)
                    for(Z=X,X=[l=228],B=[[-7,-20,6,h=17,-9,3,3][t=++t%7]-4,0,1,t-6?-A:2];l--;)
                        for(l%A?l-=l%A*!Z[l]:(P+=++k,c=l+=A);--c>A;)
                            Z[c]=Z[c-A];
            for(S="<b>";i<240;S+=(c=X[i]|(X[i]=Z[i]|=++i%A<2|i>228))?"<b style=color:#"+142*c+">■":"＿")
                i%A?0:S+="<br>";
        D.innerHTML=S+P;Z[5]||setTimeout(Y,99-P)}Y(h=e=K=t=P=0)
    </script>
</body>
