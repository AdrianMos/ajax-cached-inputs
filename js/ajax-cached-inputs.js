class Cacher {

    constructor() {
        this.cached = {}
    }

    cache(request, response) {
        this.cached[request] = response;
        //console.log(Object.keys(this.cached));
    }

    isCached(request) {
        return request in this.cached;
    }

    getCache(request) {
        return this.cached[request];
    }
}


class SuggestionsModel {

    constructor() {
        this.index = 0;
    }

    load(suggestions, input) {
        this.suggestions = suggestions;
        this.len = Object.keys(this.suggestions).length; 
        this.input = input;

        // Index len+1 is used when no suggestion is in focus.
        // When this index is reached by up/down keys, the user typed data is displayed in the input field.
        // Otherwise, the focused suggestion is displayed.
        this.index = this.len+1; 
    }
    
    getSelection() {
        if (this.index >= this.len) 
            return this.input; // when nothing is selected, we return the initial user input
        else 
            return this.suggestions[this.index].title;
    }

    getSelectionIndex() {
        return this.index;
    }

    selectIndex(index) {
        this.index = index;
        if (this.index < 0)
            this.index = this.len;
        if (this.index > this.len)
            this.index = 0;
    }

    resetIndex(index) {
        this.index = this.len + 1;
    }

    selectPrev() {
        this.index--;
        if (this.index < 0)
            this.index = this.len ;
    }

    selectNext() {
        this.index++;
        if (this.index > this.len)
            this.index = 0;
    }

    hasSuggestions() {
        return this.len > 0
    }
    
}



class SearchSuggestionsController {

    constructor(view, model, ajaxUrl) {
        this.view = view;
        this.model = model;
        this.ajaxUrl = ajaxUrl;
        this.cacher = new Cacher();
    }

    loadAndDisplaySuggestions(suggestions, input) {
        this.model.load(suggestions, input)
        this.view.populateDropdown(suggestions);
        this.view.showOrHideDropdown(this.model.hasSuggestions());
    }

    // AJAX call when the user types the search input 
    // and we don't have a cached suggestions for this input
    requestSuggestionsFromServer(input) {
        var _self = this;

        $.ajax({
            data: $.param({ search: input }),
            url: _self.ajaxUrl,
            dataType: 'json',
            success: function (response) {
                var suggestions = response.suggestions
                _self.cacher.cache(input, suggestions);
                _self.loadAndDisplaySuggestions(suggestions, input);
            },

            error: function (response) {
                _self.view.hideDropdown();
                console.log(response);
            }
        });

    }


    handleSuggestions(input) {

        //console.log("handle suggestions called");
        if (input == "") {
            // show default links... hide for now
            this.view.hideDropdown();
            return;
        }


        if (this.cacher.isCached(input)) {
            var suggestions = this.cacher.getCache(input);
            this.loadAndDisplaySuggestions(suggestions, input);
        }
        else {
            this.requestSuggestionsFromServer(input);
        }
    }
    

    init() {
        var _self = this;

        _self.view.dropdown.mouseover(function (e) {

            var index = $(e.target).closest('li').index();
            _self.view.unmarkSelection(_self.model.getSelectionIndex())
            _self.model.selectIndex(index);
            _self.view.markSelection(_self.model.getSelectionIndex());
        });


        _self.view.dropdown.mouseout(function () {
            _self.view.unmarkSelection(_self.model.getSelectionIndex())
            _self.model.resetIndex();
        });


        _self.view.input_field.focus(function () {
            if (_self.model.hasSuggestions()) {
                _self.view.showDropdown();
            }
        });

        // _self.view.dropdown.click(function (event) {
        //     console.log("onclick");
        // });


    
        _self.view.input_field.on("paste", function (e) {
            var _input = this;
            // we need a delay to read the input value after paste,
            // otherwise the read value is outdated
            setTimeout(function (e) {
                _self.handleSuggestions($(_input).val());
            }, 0);
        });


        //$('#id_search_input').on("submit", function (e) {
        //    e.preventDefault(); 
        //    console.log("SUBMIT");
            
        //});

        // Handle up/down/tab keys 
        _self.view.input_field.on("keydown", function (e) {

            switch (e.which) {
                case 38: // arrow up
                    //e.stopPropagation();
                    _self.view.unmarkSelection(_self.model.getSelectionIndex())
                    _self.model.selectPrev();
                    _self.view.showSelectionInInputField(_self.model.getSelection());
                    _self.view.markSelection(_self.model.getSelectionIndex());
                    return false;
                    break;

                case 40: // arrow down
                    _self.view.unmarkSelection(_self.model.getSelectionIndex())
                    _self.model.selectNext();
                    _self.view.showSelectionInInputField(_self.model.getSelection());
                    _self.view.markSelection(_self.model.getSelectionIndex());
                    return false;
                    break;

                case 9: // tab
                    _self.view.hideDropdown();
                    return true;
                    break;

                case 13: // enter 
                    //e.preventDefault();
                    _self.view.input_field.closest('form').submit();

                    console.log("SUBMIT");
                    return false;
                default: return;
            }
            
        });


        // Handle user keydown & keyup events
        _self.view.input_field.on("keydown keyup", function (e) {

            var code = e.keyCode || e.which;
            var key = e.key;

            var isSearchableKey = (key != "Tab") && (key != "Enter") && ((key == "Backspace") || String.fromCharCode(code).match(/(\w|\s)/g));

            // any keyup/keydown of a valid char will trigger the search for suggestions
            // Reason for why we need both keyup & keydown:
            //    we need to start on keydown so that the search is fast 
            //    (+ we cover the scenario when the user keeps the a key pressed => multiple characters in input field but no search suggestion)
            //    BUT
            //    we only get the last typed character after keyup
            //    TODO: insert logic for not triggering the same ajax request on both events
            if (isSearchableKey) {
                _self.handleSuggestions(_self.view.input_field.val());
                e.stopPropagation();
            }
        });


        // Close suggestions dropdown when clicked outside 
        $(document).mouseup(function (e) {
            var container = _self.view.container;
            var clickedOutside = !container.is(e.target) && container.has(e.target).length === 0;
            if (clickedOutside) {
                _self.view.hideDropdown();
                // $("#id_search_with_suggestions").unbind('click', clickDocument);
            }
        });

    }
}

class SuggestionsView {

    constructor(container, callbackConvertSuggestionToHtml) {    
        
        this.container = container;
        this.input_field = container.children('input').first();
        this.dropdown = container.children('ul').first();
        // other selectors: $('#'+id+' > input:first'),  $('#'+id+'> ul:first')

        this.callbackConvertSuggestionToHtml = callbackConvertSuggestionToHtml;

        this.input_field.prop('autocomplete', 'off');
        this.input_field.attr('autocapitalize', 'none');
        this.input_field.attr('autocorrect', 'off');
    }

    showDropdown() {
        this.input_field.addClass("has_suggestions");
        this.dropdown.show();
    }

    hideDropdown() {
        this.input_field.removeClass("has_suggestions");
        this.dropdown.hide();
    }

    showOrHideDropdown(show) {
        if (show) 
            this.showDropdown();
        else
            this.hideDropdown();
    }

    markSelection(idx) {
        this.dropdown.children().eq(idx).addClass("focus");
    }

    unmarkSelection(idx) {
        this.dropdown.children().eq(idx).removeClass("focus");
    }

    showSelectionInInputField(text) {
        this.input_field.val(text);
    }

    clearDropdown() {
        this.dropdown.empty();
    }


    populateDropdown(suggestions) {
        this.dropdown.empty();
        this.dropdown.append(this.convertAllSuggestionsToHtml(suggestions));
    }

    convertAllSuggestionsToHtml(suggestions) {

        var html = '';
        var i;
        for (i = 0; i < suggestions.length; i++) {
            html += this.callbackConvertSuggestionToHtml(suggestions[i]);
        } 
        return html;
    }
}



/////////////////////////////////////////////////////////////
/////////////////// Search Result Widget  ///////////////////
/////////////////////////////////////////////////////////////


class SearchSuggestionsWidget {

    constructor(id, ajaxSuggestionsUrl) {    
        var container = $('#'+id);
        this.view = new SuggestionsView(container, this.searchResultFormatFunction);
        this.model = new SuggestionsModel();
        this.controller = new SearchSuggestionsController(this.view, this.model, ajaxSuggestionsUrl);

       
    }

    init() {
        this.controller.init();
    }  


    // this might go in the view
    searchResultFormatFunction(elem) {

        var html = '';
        var hasThumbnail = elem.thumbnail != ''
        if (!hasThumbnail) {
            html += `<li role="presentation">
                    <a class="dropdown-item" href=${elem.url} tabindex="-1"> 
                            <div class="no-logo">
                            
                            </div>
                            <div class="d-flex flex-column justify-content-center">
                                <div class="category">${elem.title} </div>
                            </div>
                    </a>
                    </li>`;
        }
        else {
            html += `<li role="presentation">
                    <a class="dropdown-item" href=${elem.url} tabindex="-1">
                            <div class="logo">
                                    <img src="${elem.thumbnail}" class="rounded" width=40px; height=40px;>
                            </div>
                            <div class="d-flex flex-column justify-content-center">
                                <div class="title">${elem.title} </div>`
                            if (elem.address) 
                                html += `<div class="subtitle">${elem.address}</div>`
                    html +=`</div>
                        </a>
                    </li>`;
        }
        return html;
    }   
}




/////////////////////////////////////////////////////////////
///////////////// Category Select Controller ////////////////
/////////////////////////////////////////////////////////////



class CategorySelectWidget {


    constructor(id, ajaxSuggestionsUrl) {    
        var container = $('#'+id);
        this.view = new SuggestionsView(container, this.categorySuggestionFormatFunction);
        this.model = new SuggestionsModel();
        this.controller = new SearchSuggestionsController(this.view, this.model, ajaxSuggestionsUrl);
    }


    init() {
        this.controller.init();

        // Category list click event (ul) 
        this.view.dropdown.click(function (event) {
                        
            var category = $(event.target).closest('li') .data('category-id');
            console.log(category);            
        });
    }  

    // this might go in the view
    categorySuggestionFormatFunction(elem) {
    
        var html='';
        html += `<li role="presentation" data-category-id="${elem.id}">
                    <div class="dropdown-item"  tabindex="-1"> 
                        <div  class="d-flex flex-column ps-2 justify-content-center">
                            <div class="category" style="cursor:pointer;" >${elem.title} </div>
                        </div>
                    </div>
        </li>`;
        
        return html;
    }   
}
