package main

import (
    "fmt"
    "log"
    "net/http"
	"html/template"
)

func home(w http.ResponseWriter, r *http.Request){
	t, err := template.ParseFiles("index.html")
	if err != nil {
		log.Print(err)
		return
	}

	t.Execute(w, nil)
    fmt.Println("Endpoint Hit: home")
}

func handleRequests() {
    fs := http.FileServer(http.Dir("static/"))
    http.Handle("/static/", http.StripPrefix("/static/", fs))
    http.HandleFunc("/", home)
    log.Fatal(http.ListenAndServe(":10000", nil))
}

func main() {
    handleRequests()
}
