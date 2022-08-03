$(document).ready(function(){

    $(".skillbar").each(function(){
        var el = $("<div></div>");
        $(this).append(el);
        //el.css("width",$(this).attr("data-know")+"%");
        el.animate({width: $(this).attr("data-know")+"%"});
    });

    $(".case").hover(function(){
        //Mouse over
        var overlay = $(this).find(".overlay");
        var span = $(this).find("span");
        span.stop().clearQueue().animate({bottom: "0px"});
        overlay.stop().clearQueue().animate({opacity: 0.6});
    },function(){
        //Mouse out
        var overlay = $(this).find(".overlay");
        var span = $(this).find("span");
        span.stop().clearQueue().animate({bottom: "-"+span.height()});
        overlay.stop().clearQueue().animate({opacity: 0.0});
    }).append("<div class='overlay'></div>")

    $(window).resize(function(){
        $(".case span").each(function(){
            $(this).css("bottom","-"+$(this).height());
        });
    }).resize();


    $(".article.contact").animate({"background-position-y": "50%"},2000,"easeOutBounce");
});
